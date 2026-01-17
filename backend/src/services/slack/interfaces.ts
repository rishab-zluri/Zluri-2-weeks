/**
 * Query request with Slack-relevant fields
 */
export interface SlackQueryRequest {
    id: number | string;
    uuid?: string;
    userEmail: string;
    approverEmail?: string;
    slackUserId?: string;
    instanceName: string;
    databaseType: string;
    databaseName?: string;
    podName: string;
    managerEmail?: string;
    managerSlackId?: string;
    submissionType: 'query' | 'script';
    queryContent?: string | null;
    scriptFilename?: string | null;
    comments: string;
    rejectionReason?: string | null;
}

/**
 * Formatted execution result
 */
export interface FormattedExecutionResult {
    success: boolean;
    summary?: string;
    preview?: string | null;
    duration?: number | null;
    error?: {
        type: string;
        message: string;
        line?: number | null;
        code?: string | null;
    };
}

/**
 * Formatted error message
 */
export interface FormattedError {
    type: string;
    message: string;
    line?: number | null;
}
