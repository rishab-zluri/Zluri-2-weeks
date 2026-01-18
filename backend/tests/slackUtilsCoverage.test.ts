
import { describe, it, expect } from '@jest/globals';
import {
    truncate,
    formatExecutionResult,
    formatErrorMessage,
    formatQueryPreview
} from '../src/services/slack/utils';
import { SlackQueryRequest } from '../src/services/slack/interfaces';

describe('Slack Utils Coverage', () => {

    describe('truncate', () => {
        it('should return empty string for null/undefined/empty input', () => {
            expect(truncate(null)).toBe('');
            expect(truncate(undefined)).toBe('');
            expect(truncate('')).toBe('');
        });

        it('should return original string if length <= maxLength', () => {
            expect(truncate('abc', 5)).toBe('abc');
            expect(truncate('abcde', 5)).toBe('abcde');
        });

        it('should truncate and add ellipsis', () => {
            expect(truncate('abcdef', 5)).toBe('ab...');
            expect(truncate('Long text here', 7)).toBe('Long...');
        });

        it('should use default maxLength of 200', () => {
            const longText = 'a'.repeat(205);
            const result = truncate(longText);
            expect(result.length).toBe(200);
            expect(result.endsWith('...')).toBe(true);
        });
    });

    describe('formatExecutionResult', () => {
        it('should handle invalid JSON', () => {
            const result = formatExecutionResult('invalid json');
            expect(result.success).toBe(true);
            expect(result.summary).toBe('Execution completed');
            expect(result.preview).toBe('invalid json');
        });

        it('should handle explicitly failed execution', () => {
            const json = JSON.stringify({ success: false, error: { message: 'Failed' } });
            const result = formatExecutionResult(json);
            expect(result.success).toBe(false);
            expect(result.error?.message).toBe('Failed');
        });

        it('should handle nested executionResult failure', () => {
            const json = JSON.stringify({ executionResult: { success: false, error: { message: 'Nested Fail' } } });
            const result = formatExecutionResult(json);
            expect(result.success).toBe(false);
            expect(result.error?.message).toBe('Nested Fail');
        });

        it('should build summary with rows fetched', () => {
            const json = JSON.stringify({ summary: { rowsReturned: 5 } });
            const result = formatExecutionResult(json);
            expect(result.summary).toContain('5 row(s) fetched');
        });

        it('should build summary with rows affected', () => {
            const json = JSON.stringify({ summary: { rowsAffected: 3 } });
            const result = formatExecutionResult(json);
            expect(result.summary).toContain('3 row(s) affected');
        });

        it('should parse output array for query stats', () => {
            const json = JSON.stringify({
                output: [
                    { type: 'query', queryType: 'SELECT', rowCount: 10 },
                    { type: 'query', queryType: 'UPDATE', rowCount: 2 }
                ]
            });
            const result = formatExecutionResult(json);
            expect(result.summary).toContain('10 row(s) fetched');
            expect(result.summary).toContain('2 row(s) affected');
            expect(result.summary).toContain('2 query(ies) executed');
        });

        it('should parse output array for data items limit fetch', () => {
            const json = JSON.stringify({
                output: [
                    { type: 'data', totalRows: 15, preview: [1, 2, 3] }
                ]
            });
            const result = formatExecutionResult(json);
            expect(result.summary).toContain('15 row(s) fetched');
        });

        it('should parse output array for operations', () => {
            const json = JSON.stringify({
                output: [
                    { type: 'operation', count: 5, insertedCount: 2, modifiedCount: 1, deletedCount: 1 }
                ]
            });
            const result = formatExecutionResult(json);
            expect(result.summary).toContain('7 document(s) processed'); // 5 + 2
            expect(result.summary).toContain('2 row(s) affected'); // 1 + 1
            expect(result.summary).toContain('1 operation(s) completed');
        });

        it('should generate preview from simple rows', () => {
            const rows = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
            const json = JSON.stringify({ rows });
            const result = formatExecutionResult(json);
            expect(result.preview).toContain('{"id":1}');
            expect(result.preview).toContain('1 more row(s)');
        });

        it('should generate preview from nested result.rows', () => {
            const rows = [{ id: 1 }, { id: 2 }];
            const json = JSON.stringify({ result: { rows } });
            const result = formatExecutionResult(json);
            expect(result.preview).toContain('{"id":1}');
        });

        it('should truncate long row strings in preview', () => {
            const longVal = 'a'.repeat(200);
            const rows = [{ val: longVal }];
            const json = JSON.stringify({ rows });
            const result = formatExecutionResult(json);
            expect(result.preview).toContain('...');
            expect(result.preview?.length).toBeLessThan(150);
        });

        it('should fallback to rowCount processing', () => {
            const json = JSON.stringify({ rowCount: 99 });
            const result = formatExecutionResult(json);
            expect(result.summary).toContain('99 row(s) fetched');
        });

        it('should count rowsAffected from result type items', () => {
            const json = JSON.stringify({
                output: [{ type: 'result', rowsAffected: 10 }]
            });
            const result = formatExecutionResult(json);
            expect(result.summary).toContain('10 row(s) affected');
        });

        it('should truncate preview for nested result.rows (>3)', () => {
            const rows = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
            const json = JSON.stringify({ result: { rows } });
            const result = formatExecutionResult(json);
            expect(result.preview).toContain('1 more row(s)');
        });
    });

    describe('formatErrorMessage', () => {
        it('should parse JSON error message', () => {
            const msg = JSON.stringify({ error: { message: 'Parsed', type: 'Custom', line: 5 } });
            const result = formatErrorMessage(msg);
            expect(result.message).toBe('Parsed');
            expect(result.type).toBe('Custom');
            expect(result.line).toBe(5);
        });

        it('should handle non-JSON string', () => {
            const result = formatErrorMessage('Plain error');
            expect(result.message).toBe('Plain error');
            expect(result.type).toBe('Error');
        });

        it('should detect SyntaxError type', () => {
            const result = formatErrorMessage('SyntaxError: Invalid code');
            expect(result.type).toBe('SyntaxError');
            expect(result.message).toBe('Invalid code');
        });

        it('should extract line number from format', () => {
            const result = formatErrorMessage('Error at line 42: something wrong');
            expect(result.line).toBe(42);
        });

        it('should extract line number from colon format', () => {
            const result = formatErrorMessage('Error:15:10 message');
            expect(result.line).toBe(15);
        });
    });

    describe('formatQueryPreview', () => {
        it('should format query submission', () => {
            const req = { submissionType: 'query', queryContent: 'SELECT * FROM users' } as SlackQueryRequest;
            expect(formatQueryPreview(req)).toContain('SELECT * FROM users');
        });

        it('should truncate long query submission', () => {
            const longQuery = 'SELECT ' + 'a'.repeat(200);
            const req = { submissionType: 'query', queryContent: longQuery } as SlackQueryRequest;
            expect(formatQueryPreview(req).length).toBeLessThan(150);
        });

        it('should format script submission with filename', () => {
            const req = { submissionType: 'script', scriptFilename: 'test.py' } as SlackQueryRequest;
            expect(formatQueryPreview(req)).toBe('Script: test.py');
        });

        it('should format script submission without filename', () => {
            const req = { submissionType: 'script' } as SlackQueryRequest;
            expect(formatQueryPreview(req)).toBe('Script: uploaded script');
        });
    });
});
