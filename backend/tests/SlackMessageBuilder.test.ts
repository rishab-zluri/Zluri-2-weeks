/**
 * SlackMessageBuilder Tests
 */
import { describe, it, expect } from '@jest/globals';
import { SlackMessageBuilder } from '../src/services/slack/SlackMessageBuilder';
import { SlackQueryRequest, FormattedExecutionResult, FormattedError } from '../src/services/slack/interfaces';

describe('SlackMessageBuilder', () => {
    const mockRequest: SlackQueryRequest = {
        id: 123,
        userEmail: 'user@example.com',
        instanceName: 'Test DB',
        databaseType: 'postgresql',
        podName: 'Test Pod',
        comments: 'Test comment',
        submissionType: 'query',
        queryContent: 'SELECT * FROM users',
        approverEmail: 'approver@example.com'
    };

    describe('buildNewSubmissionMessage', () => {
        it('should build basic submission message', () => {
            const blocks = SlackMessageBuilder.buildNewSubmissionMessage(mockRequest);
            expect(blocks).toBeDefined();
            expect(Array.isArray(blocks)).toBe(true);

            // Basic checks for content
            const json = JSON.stringify(blocks);
            expect(json).toContain('New Query Request');
            expect(json).toContain('#123');
            expect(json).toContain('user@example.com');
            expect(json).toContain('Test DB');
        });

        it('should include manager slack ID if present', () => {
            const reqWithManager = { ...mockRequest, managerSlackId: 'U999' };
            const blocks = SlackMessageBuilder.buildNewSubmissionMessage(reqWithManager);
            const json = JSON.stringify(blocks);
            expect(json).toContain('<@U999>');
        });

        it('should fallback to manager email if slack ID missing', () => {
            const reqWithManager = { ...mockRequest, managerEmail: 'manager@example.com' };
            const blocks = SlackMessageBuilder.buildNewSubmissionMessage(reqWithManager);
            const json = JSON.stringify(blocks);
            expect(json).toContain('manager@example.com');
        });
    });

    describe('buildApprovalSuccessMessage', () => {
        it('should build success message with summary', () => {
            const result: FormattedExecutionResult = {
                success: true,
                summary: '10 rows',
                duration: 100
            };

            const blocks = SlackMessageBuilder.buildApprovalSuccessMessage(mockRequest, result);
            const json = JSON.stringify(blocks);

            expect(json).toContain('Query Executed Successfully');
            expect(json).toContain('10 rows');
            expect(json).toContain('100ms');
        });

        it('should include preview if present', () => {
            const result: FormattedExecutionResult = {
                success: true,
                summary: '10 rows',
                preview: 'row1\nrow2'
            };

            const blocks = SlackMessageBuilder.buildApprovalSuccessMessage(mockRequest, result);
            const json = JSON.stringify(blocks);

            expect(json).toContain('Preview');
            expect(json).toContain('row1');
        });
    });

    describe('buildApprovalFailureMessage', () => {
        it('should build failure message with error', () => {
            const error: FormattedError = {
                type: 'ExecutionError',
                message: 'Syntax error'
            };

            const blocks = SlackMessageBuilder.buildApprovalFailureMessage(mockRequest, error);
            const json = JSON.stringify(blocks);

            expect(json).toContain('Query Execution Failed');
            expect(json).toContain('ExecutionError');
            expect(json).toContain('Syntax error');
        });

        it('should include line number if present', () => {
            const error: FormattedError = {
                type: 'ExecutionError',
                message: 'Syntax error',
                line: 5
            };

            const blocks = SlackMessageBuilder.buildApprovalFailureMessage(mockRequest, error);
            const json = JSON.stringify(blocks);

            expect(json).toContain('Line 5');
        });

        it('should include duration if provided', () => {
            const error: FormattedError = { type: 'Error', message: 'fail' };
            const blocks = SlackMessageBuilder.buildApprovalFailureMessage(mockRequest, error, 500);
            const json = JSON.stringify(blocks);

            expect(json).toContain('500ms');
        });
    });

    describe('buildRejectionMessage', () => {
        it('should build basic rejection message', () => {
            const blocks = SlackMessageBuilder.buildRejectionMessage(mockRequest);
            const json = JSON.stringify(blocks);

            expect(json).toContain('Query Request Rejected');
            expect(json).toContain('approver@example.com');
        });

        it('should include reason if provided', () => {
            const reqWithReason = { ...mockRequest, rejectionReason: 'Bad query' };
            const blocks = SlackMessageBuilder.buildRejectionMessage(reqWithReason);
            const json = JSON.stringify(blocks);

            expect(json).toContain('Bad query');
        });
    });
});
