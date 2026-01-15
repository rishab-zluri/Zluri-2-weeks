import { SlackQueryRequest, FormattedExecutionResult, FormattedError } from './interfaces';

/**
 * Truncate text to specified length
 * Preserves readability by adding ellipsis
 */
export function truncate(text: string | null | undefined, maxLength: number = 200): string {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
}

/**
 * Format execution result for concise Slack display
 *
 * Parses the JSON result and extracts:
 * - Success/failure status
 * - Row/document counts
 * - Data preview (first 3 rows)
 * - Duration
 */
export function formatExecutionResult(resultStr: string): FormattedExecutionResult {
    try {
        const result = JSON.parse(resultStr);

        // Check if execution failed
        if (result.success === false || (result.executionResult && result.executionResult.success === false)) {
            const errorData = result.error || result.executionResult?.error || {};
            return {
                success: false,
                error: {
                    type: errorData.type || 'Error',
                    message: errorData.message || 'Execution failed',
                    line: errorData.line || null,
                    code: errorData.code || null,
                },
                duration: result.duration || result.executionResult?.duration || null,
            };
        }

        // Build concise summary
        const parts: string[] = [];
        let totalRowsFetched = 0;
        let totalRowsAffected = 0;
        let totalQueries = 0;
        let totalOperations = 0;
        let totalDocs = 0;

        // Check summary object first
        const summary = result.summary || result.executionResult?.summary || {};
        if (summary.rowsReturned) totalRowsFetched += summary.rowsReturned;
        if (summary.rowsAffected) totalRowsAffected += summary.rowsAffected;
        if (summary.totalQueries) totalQueries += summary.totalQueries;
        if (summary.totalOperations) totalOperations += summary.totalOperations;
        if (summary.documentsProcessed) totalDocs += summary.documentsProcessed;

        // Parse output array
        const output = result.output || result.executionResult?.output || [];
        if (Array.isArray(output)) {
            for (const item of output) {
                if (item.type === 'query') {
                    totalQueries++;
                    if (item.rowCount) {
                        if (item.queryType === 'SELECT') {
                            totalRowsFetched += item.rowCount;
                        } else {
                            totalRowsAffected += item.rowCount;
                        }
                    }
                }
                if (item.type === 'data') {
                    const count = item.totalRows || item.totalDocs || (item.preview?.length || 0);
                    if (count > 0 && totalRowsFetched === 0) {
                        totalRowsFetched = count;
                    }
                }
                if (item.type === 'result' && item.rowsAffected) {
                    totalRowsAffected += item.rowsAffected;
                }
                if (item.type === 'operation') {
                    totalOperations++;
                    if (item.count) totalDocs += item.count;
                    if (item.insertedCount) totalDocs += item.insertedCount;
                    if (item.modifiedCount) totalRowsAffected += item.modifiedCount;
                    if (item.deletedCount) totalRowsAffected += item.deletedCount;
                }
            }
        }

        // Also check direct rowCount on result
        if (result.rowCount && totalRowsFetched === 0) {
            totalRowsFetched = result.rowCount;
        }

        // Build summary text
        if (totalRowsFetched > 0) parts.push(`📊 ${totalRowsFetched} row(s) fetched`);
        if (totalRowsAffected > 0) parts.push(`✏️ ${totalRowsAffected} row(s) affected`);
        if (totalDocs > 0) parts.push(`📄 ${totalDocs} document(s) processed`);
        if (totalQueries > 0) parts.push(`🔍 ${totalQueries} query(ies) executed`);
        if (totalOperations > 0) parts.push(`⚙️ ${totalOperations} operation(s) completed`);

        const summaryText = parts.length > 0 ? parts.join(' | ') : 'Execution completed';

        // Get data preview (first 3 rows)
        let preview = '';
        if (Array.isArray(output)) {
            const dataItems = output.filter((item: { type: string }) => item.type === 'data');
            if (dataItems.length > 0 && dataItems[0].preview) {
                const rows = dataItems[0].preview.slice(0, 3);
                if (rows.length > 0) {
                    preview = rows.map((row: unknown) => {
                        const rowStr = JSON.stringify(row);
                        return rowStr.length > 100 ? rowStr.substring(0, 97) + '...' : rowStr;
                    }).join('\n');

                    const total = dataItems[0].totalRows || dataItems[0].totalDocs || rows.length;
                    if (total > 3) {
                        preview += `\n... and ${total - 3} more row(s)`;
                    }
                }
            }
        }

        // For simple query results
        if (!preview && result.rows && Array.isArray(result.rows) && result.rows.length > 0) {
            const rows = result.rows.slice(0, 3);
            preview = rows.map((row: unknown) => {
                const rowStr = JSON.stringify(row);
                return rowStr.length > 100 ? rowStr.substring(0, 97) + '...' : rowStr;
            }).join('\n');

            if (result.rows.length > 3) {
                preview += `\n... and ${result.rows.length - 3} more row(s)`;
            }
        }

        // Check nested result object
        if (!preview && result.result?.rows && Array.isArray(result.result.rows) && result.result.rows.length > 0) {
            const rows = result.result.rows.slice(0, 3);
            preview = rows.map((row: unknown) => {
                const rowStr = JSON.stringify(row);
                return rowStr.length > 100 ? rowStr.substring(0, 97) + '...' : rowStr;
            }).join('\n');

            if (result.result.rows.length > 3) {
                preview += `\n... and ${result.result.rows.length - 3} more row(s)`;
            }
        }

        return {
            success: true,
            summary: summaryText,
            preview: preview || null,
            duration: result.duration || result.executionResult?.duration || null,
        };
    } catch (e) {
        return {
            success: true,
            summary: 'Execution completed',
            preview: truncate(resultStr, 300),
            duration: null,
        };
    }
}

/**
 * Format error for concise Slack display
 */
export function formatErrorMessage(errorMessage: string): FormattedError {
    try {
        const parsed = JSON.parse(errorMessage);
        if (parsed.error) {
            return {
                type: parsed.error.type || 'Error',
                message: parsed.error.message || errorMessage,
                line: parsed.error.line || null,
            };
        }
    } catch (e) {
        // Not JSON, parse the string
    }

    let errorType = 'Error';
    let line: number | null = null;
    let cleanMessage = errorMessage;

    // Check for common error types
    const typeMatch = errorMessage.match(/^(SyntaxError|TypeError|ReferenceError|DatabaseError|TimeoutError|ConnectionError|ValidationError):/i);
    if (typeMatch) {
        errorType = typeMatch[1];
        cleanMessage = errorMessage.substring(typeMatch[0].length).trim();
    }

    // Extract line number if present
    const lineMatch = errorMessage.match(/line\s*(\d+)/i) || errorMessage.match(/:(\d+):\d+/);
    if (lineMatch) {
        line = parseInt(lineMatch[1], 10);
    }

    return {
        type: errorType,
        message: cleanMessage,
        line,
    };
}

/**
 * Format query preview for Slack
 */
export function formatQueryPreview(request: SlackQueryRequest): string {
    if (request.submissionType === 'query') {
        return `\`${truncate(request.queryContent, 100)}\``;
    }
    return `Script: ${request.scriptFilename || 'uploaded script'}`;
}
