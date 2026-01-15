/**
 * Slack Service
 *
 * Handle Slack notifications for query requests.
 * 
 * REFACTORING NOTE:
 * This service now uses the Builder Pattern (via SlackMessageBuilder and slack-block-builder)
 * for constructing messages.
 */

import { WebClient, ChatPostMessageArguments } from '@slack/web-api';
import config from '../../config';
import logger from '../../utils/logger';
import { SlackMessageBuilder } from './SlackMessageBuilder';
import { SlackQueryRequest, FormattedExecutionResult, FormattedError } from './interfaces';
import { truncate, formatExecutionResult, formatErrorMessage, formatQueryPreview } from './utils';

// Re-export types
export * from './interfaces';
// Re-export specific utils for index.ts compatibility
export { truncate, formatExecutionResult, formatErrorMessage, formatQueryPreview } from './utils';

// =============================================================================
// CLIENT INITIALIZATION
// =============================================================================

/**
 * Slack WebClient singleton
 * Initialized only if bot token is configured
 */
let slackClient: WebClient | null = null;
if (config.slack.botToken) {
    slackClient = new WebClient(config.slack.botToken);
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Check if Slack is configured and available
 */
export function isConfigured(): boolean {
    return config.slack.enabled && !!slackClient;
}

// =============================================================================
// NOTIFICATION FUNCTIONS
// =============================================================================

/**
 * Send notification for new submission
 * Notifies the approval channel about a new query request
 */
export async function notifyNewSubmission(request: SlackQueryRequest): Promise<void> {
    if (!isConfigured() || !slackClient) {
        logger.info('Slack not configured, skipping notification');
        return;
    }

    try {
        const blocks = SlackMessageBuilder.buildNewSubmissionMessage(request) || [];

        const message: ChatPostMessageArguments = {
            channel: config.slack.approvalChannel,
            blocks: blocks as any, // compatible with @slack/web-api
            text: `New query request #${request.id} from ${request.userEmail}`,
        };

        await slackClient.chat.postMessage(message);
        logger.info('Slack notification sent for new submission', { requestId: request.id });
    } catch (error) {
        const err = error as Error;
        logger.error('Failed to send Slack notification', { error: err.message, requestId: request.id });
    }
}

/**
 * Get Slack user ID - either from request or by looking up email
 */
async function getSlackUserId(request: SlackQueryRequest): Promise<string | null> {
    if (request.slackUserId) {
        return request.slackUserId;
    }

    if (request.userEmail) {
        return await lookupUserByEmail(request.userEmail);
    }

    return null;
}

/**
 * Send notification for approval with results
 * Notifies both the channel and the requester via DM
 */
export async function notifyApprovalSuccess(request: SlackQueryRequest, result: string): Promise<void> {
    if (!isConfigured() || !slackClient) return;

    try {
        const formatted = formatExecutionResult(result);

        // If execution actually failed, send failure notification
        if (formatted.success === false && formatted.error) {
            const blocks = SlackMessageBuilder.buildApprovalFailureMessage(
                request,
                formatted.error,
                formatted.duration
            ) || [];

            const channelMessage: ChatPostMessageArguments = {
                channel: config.slack.approvalChannel,
                blocks: blocks as any,
                text: `Query #${request.id} execution failed`,
            };

            await slackClient.chat.postMessage(channelMessage);

            const slackUserId = await getSlackUserId(request);
            if (slackUserId) {
                await sendDirectMessage(slackUserId, blocks as any[], channelMessage.text || '');
            }

            logger.info('Slack execution failure notification sent', { requestId: request.id });
            return;
        }

        // Success case
        const blocks = SlackMessageBuilder.buildApprovalSuccessMessage(request, formatted) || [];

        const channelMessage: ChatPostMessageArguments = {
            channel: config.slack.approvalChannel,
            blocks: blocks as any,
            text: `Query #${request.id} executed successfully`,
        };

        await slackClient.chat.postMessage(channelMessage);

        const slackUserId = await getSlackUserId(request);
        if (slackUserId) {
            await sendDirectMessage(slackUserId, blocks as any[], channelMessage.text || '');
            logger.info('Sent DM to requester', { requestId: request.id, slackUserId });
        } else {
            logger.warn('Could not send DM - no Slack user ID found', { requestId: request.id, email: request.userEmail });
        }

        logger.info('Slack approval success notification sent', { requestId: request.id });
    } catch (error) {
        const err = error as Error;
        logger.error('Failed to send Slack approval notification', { error: err.message });
    }
}

/**
 * Send notification for approval failure
 */
export async function notifyApprovalFailure(request: SlackQueryRequest, errorMessage: string): Promise<void> {
    if (!isConfigured() || !slackClient) return;

    try {
        const formatted = formatErrorMessage(errorMessage);
        const blocks = SlackMessageBuilder.buildApprovalFailureMessage(request, formatted) || [];

        const channelMessage: ChatPostMessageArguments = {
            channel: config.slack.approvalChannel,
            blocks: blocks as any,
            text: `Query #${request.id} execution failed`,
        };

        await slackClient.chat.postMessage(channelMessage);

        const slackUserId = await getSlackUserId(request);
        if (slackUserId) {
            await sendDirectMessage(slackUserId, blocks as any[], channelMessage.text || '');
            logger.info('Sent failure DM to requester', { requestId: request.id, slackUserId });
        } else {
            logger.warn('Could not send failure DM - no Slack user ID found', { requestId: request.id, email: request.userEmail });
        }

        logger.info('Slack failure notification sent', { requestId: request.id });
    } catch (error) {
        const err = error as Error;
        logger.error('Failed to send Slack failure notification', { error: err.message });
    }
}

/**
 * Send notification for rejection
 * Notifies the requester via DM about their rejected request
 */
export async function notifyRejection(request: SlackQueryRequest): Promise<void> {
    if (!isConfigured() || !slackClient) return;

    try {
        const blocks = SlackMessageBuilder.buildRejectionMessage(request) || [];

        const slackUserId = await getSlackUserId(request);
        if (slackUserId) {
            await sendDirectMessage(slackUserId, blocks as any[], `Query #${request.id} rejected`);
            logger.info('Sent rejection DM to requester', { requestId: request.id, slackUserId });
        } else {
            logger.warn('Could not send rejection DM - no Slack user ID found', { requestId: request.id, email: request.userEmail });
        }

        logger.info('Slack rejection notification sent', { requestId: request.id });
    } catch (error) {
        const err = error as Error;
        logger.error('Failed to send Slack rejection notification', { error: err.message });
    }
}

/**
 * Send direct message to user
 * Opens a DM channel and sends the message
 */
export async function sendDirectMessage(userId: string, blocks: any[], text: string): Promise<void> {
    if (!isConfigured() || !slackClient) return;

    try {
        const result = await slackClient.conversations.open({ users: userId });

        if (result.ok && result.channel) {
            await slackClient.chat.postMessage({
                channel: result.channel.id as string,
                blocks: blocks as ChatPostMessageArguments['blocks'],
                text,
            });
        }
    } catch (error) {
        const err = error as Error;
        logger.error('Failed to send DM', { error: err.message, userId });
    }
}

/**
 * Look up user by email
 */
export async function lookupUserByEmail(email: string): Promise<string | null> {
    if (!isConfigured() || !slackClient) return null;

    try {
        const result = await slackClient.users.lookupByEmail({ email });
        return result.user?.id || null;
    } catch (error) {
        logger.debug('Could not find Slack user by email', { email });
        return null;
    }
}

/**
 * Test Slack connection
 */
export async function testConnection(): Promise<boolean> {
    if (!isConfigured() || !slackClient) return false;

    try {
        const result = await slackClient.auth.test();
        logger.info('Slack connection successful', { team: result.team });
        return true;
    } catch (error) {
        const err = error as Error;
        logger.error('Slack connection failed', { error: err.message });
        return false;
    }
}

// Default export for backward compatibility
export default {
    isConfigured,
    notifyNewSubmission,
    notifyApprovalSuccess,
    notifyApprovalFailure,
    notifyRejection,
    sendDirectMessage,
    lookupUserByEmail,
    testConnection,
};
