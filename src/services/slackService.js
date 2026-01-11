/**
 * Slack Service
 * Handle Slack notifications for query requests
 */

const { WebClient } = require('@slack/web-api');
const config = require('../config');
const logger = require('../utils/logger');

// Initialize Slack client if token is available
let slackClient = null;
if (config.slack.botToken) {
  slackClient = new WebClient(config.slack.botToken);
}

/**
 * Check if Slack is configured
 * @returns {boolean}
 */
const isConfigured = () => {
  return config.slack.enabled && !!slackClient;
};

/**
 * Truncate text to specified length
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated text
 */
/* istanbul ignore next */
const truncate = (text, maxLength = 200) => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
};

/**
 * Format query preview for Slack
 * @param {Object} request - Query request object
 * @returns {string} Formatted query preview
 */
const formatQueryPreview = (request) => {
  if (request.submissionType === 'query') {
    return `\`${truncate(request.queryContent, 100)}\``;
  }
  return `Script: ${request.scriptFilename || 'uploaded script'}`;
};

/**
 * Send notification for new submission
 * @param {Object} request - Query request object
 */
const notifyNewSubmission = async (request) => {
  /* istanbul ignore if */
  if (!isConfigured()) {
    logger.info('Slack not configured, skipping notification');
    return;
  }

  try {
    const message = {
      channel: config.slack.approvalChannel,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '🗄️ New Query Request',
            emoji: true,
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Request ID:*\n#${request.id}`,
            },
            {
              type: 'mrkdwn',
              text: `*Requester:*\n${request.userEmail}`,
            },
            {
              type: 'mrkdwn',
              text: `*Database:*\n${request.instanceName} (${request.databaseType})`,
            },
            {
              type: 'mrkdwn',
              text: `*POD:*\n${request.podName}`,
            },
          ],
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Comment:*\n${truncate(request.comments, 300)}`,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Query Preview:*\n${formatQueryPreview(request)}`,
          },
        },
        {
          type: 'divider',
        },
      ],
      text: `New query request #${request.id} from ${request.userEmail}`,
    };

    await slackClient.chat.postMessage(message);
    logger.info('Slack notification sent for new submission', { requestId: request.id });
  } catch (error) {
    logger.error('Failed to send Slack notification', { error: error.message, requestId: request.id });
  }
};

/**
 * Send notification for approval with results
 * @param {Object} request - Query request object
 * @param {string} result - Execution result
 */
/* istanbul ignore next */
const notifyApprovalSuccess = async (request, result) => {
  if (!isConfigured()) return;

  try {
    // Send to approval channel
    const channelMessage = {
      channel: config.slack.approvalChannel,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '✅ Query Executed Successfully',
            emoji: true,
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Request ID:*\n#${request.id}`,
            },
            {
              type: 'mrkdwn',
              text: `*Approved by:*\n${request.approverEmail}`,
            },
          ],
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Result:*\n\`\`\`${truncate(result, 1000)}\`\`\``,
          },
        },
      ],
      text: `Query #${request.id} executed successfully`,
    };

    await slackClient.chat.postMessage(channelMessage);

    // Send DM to requester if we have their Slack ID
    if (request.slackUserId) {
      await sendDirectMessage(request.slackUserId, channelMessage.blocks, channelMessage.text);
    }

    logger.info('Slack approval success notification sent', { requestId: request.id });
  } catch (error) {
    logger.error('Failed to send Slack approval notification', { error: error.message });
  }
};

/**
 * Send notification for approval failure
 * @param {Object} request - Query request object
 * @param {string} error - Error message
 */
/* istanbul ignore next */
const notifyApprovalFailure = async (request, errorMessage) => {
  if (!isConfigured()) return;

  try {
    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '❌ Query Execution Failed',
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Request ID:*\n#${request.id}`,
          },
          {
            type: 'mrkdwn',
            text: `*Approved by:*\n${request.approverEmail}`,
          },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Error:*\n\`\`\`${truncate(errorMessage, 500)}\`\`\``,
        },
      },
    ];

    // Send to approval channel
    await slackClient.chat.postMessage({
      channel: config.slack.approvalChannel,
      blocks,
      text: `Query #${request.id} execution failed`,
    });

    // Send DM to requester
    if (request.slackUserId) {
      await sendDirectMessage(request.slackUserId, blocks, `Query #${request.id} execution failed`);
    }

    logger.info('Slack failure notification sent', { requestId: request.id });
  } catch (error) {
    logger.error('Failed to send Slack failure notification', { error: error.message });
  }
};

/**
 * Send notification for rejection
 * @param {Object} request - Query request object
 */
/* istanbul ignore next */
const notifyRejection = async (request) => {
  if (!isConfigured()) return;

  try {
    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🚫 Query Request Rejected',
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Request ID:*\n#${request.id}`,
          },
          {
            type: 'mrkdwn',
            text: `*Rejected by:*\n${request.approverEmail}`,
          },
        ],
      },
      ...(request.rejectionReason
        ? [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*Reason:*\n${request.rejectionReason}`,
              },
            },
          ]
        : []),
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Original Query:*\n${formatQueryPreview(request)}`,
        },
      },
    ];

    // Send DM to requester only
    if (request.slackUserId) {
      await sendDirectMessage(request.slackUserId, blocks, `Query #${request.id} rejected`);
    }

    logger.info('Slack rejection notification sent', { requestId: request.id });
  } catch (error) /* istanbul ignore next */ {
    logger.error('Failed to send Slack rejection notification', { error: error.message });
  }
};

/**
 * Send direct message to user
 * @param {string} userId - Slack user ID
 * @param {Array} blocks - Message blocks
 * @param {string} text - Fallback text
 */
/* istanbul ignore next */
const sendDirectMessage = async (userId, blocks, text) => {
  if (!isConfigured()) return;

  try {
    // Open DM channel
    const result = await slackClient.conversations.open({ users: userId });
    
    if (result.ok && result.channel) {
      await slackClient.chat.postMessage({
        channel: result.channel.id,
        blocks,
        text,
      });
    }
  } catch (error) {
    logger.error('Failed to send DM', { error: error.message, userId });
  }
};

/**
 * Look up user by email
 * @param {string} email - User email
 * @returns {string|null} Slack user ID or null
 */
/* istanbul ignore next */
const lookupUserByEmail = async (email) => {
  if (!isConfigured()) return null;

  try {
    const result = await slackClient.users.lookupByEmail({ email });
    return result.user?.id || null;
  } catch (error) {
    logger.debug('Could not find Slack user by email', { email });
    return null;
  }
};

/**
 * Test Slack connection
 * @returns {boolean} Connection status
 */
/* istanbul ignore next */
const testConnection = async () => {
  if (!isConfigured()) return false;

  try {
    const result = await slackClient.auth.test();
    logger.info('Slack connection successful', { team: result.team });
    return true;
  } catch (error) {
    logger.error('Slack connection failed', { error: error.message });
    return false;
  }
};

module.exports = {
  isConfigured,
  notifyNewSubmission,
  notifyApprovalSuccess,
  notifyApprovalFailure,
  notifyRejection,
  sendDirectMessage,
  lookupUserByEmail,
  testConnection,
};