import { Message, Blocks } from 'slack-block-builder';
import { SlackQueryRequest, FormattedExecutionResult, FormattedError } from './interfaces';
import { truncate, formatQueryPreview } from './utils';

export class SlackMessageBuilder {
    /**
     * Build message for new query submission
     */
    static buildNewSubmissionMessage(request: SlackQueryRequest) {
        return Message()
            .blocks(
                Blocks.Header({ text: '🗄️ New Query Request' }),
                Blocks.Section()
                    .fields([
                        `*Request ID:*\n#${request.id}`,
                        `*Requester:*\n${request.userEmail}`,
                        `*Database:*\n${request.instanceName} (${request.databaseType})`,
                        `*POD:*\n${request.podName}`,
                    ]),
                Blocks.Section({
                    text: `*Comment:*\n${truncate(request.comments, 300)}`
                }),
                Blocks.Section({
                    text: `*Query Preview:*\n${formatQueryPreview(request)}`
                }),
                Blocks.Divider()
            )
            .buildToObject().blocks;
    }

    /**
     * Build message for successful execution (approval)
     */
    static buildApprovalSuccessMessage(request: SlackQueryRequest, result: FormattedExecutionResult) {
        const message = Message()
            .blocks(
                Blocks.Header({ text: '✅ Query Executed Successfully' }),
                Blocks.Section()
                    .fields([
                        `*Request ID:*\n#${request.id}`,
                        `*Approved by:*\n${request.approverEmail}`,
                    ]),
                Blocks.Section({
                    text: `*Summary:*\n${result.summary}${result.duration ? ` (${result.duration}ms)` : ''}`
                })
            );

        if (result.preview) {
            message.blocks(
                Blocks.Section({
                    text: `*Preview:*\n\`\`\`${result.preview}\`\`\``
                })
            );
        }

        return message.buildToObject().blocks;
    }

    /**
     * Build message for failed execution (approval)
     */
    static buildApprovalFailureMessage(request: SlackQueryRequest, error: FormattedError, duration?: number | null) {
        let errorText = `*Error Type:* ${error.type}`;
        if (error.line) {
            errorText += ` (Line ${error.line})`;
        }
        errorText += `\n*Reason:* ${truncate(error.message, 300)}`;

        const message = Message()
            .blocks(
                Blocks.Header({ text: '❌ Query Execution Failed' }),
                Blocks.Section()
                    .fields([
                        `*Request ID:*\n#${request.id}`,
                        `*Approved by:*\n${request.approverEmail}`,
                    ]),
                Blocks.Section({
                    text: errorText
                })
            );

        if (duration) {
            message.blocks(
                Blocks.Context()
                    .elements([`⏱️ Duration: ${duration}ms`])
            );
        }

        return message.buildToObject().blocks;
    }

    /**
     * Build message for rejection
     */
    static buildRejectionMessage(request: SlackQueryRequest) {
        const message = Message()
            .blocks(
                Blocks.Header({ text: '🚫 Query Request Rejected' }),
                Blocks.Section()
                    .fields([
                        `*Request ID:*\n#${request.id}`,
                        `*Rejected by:*\n${request.approverEmail}`,
                    ])
            );

        if (request.rejectionReason) {
            message.blocks(
                Blocks.Section({
                    text: `*Reason:*\n${request.rejectionReason}`
                })
            );
        }

        message.blocks(
            Blocks.Section({
                text: `*Original Query:*\n${formatQueryPreview(request)}`
            })
        );

        return message.buildToObject().blocks;
    }
}
