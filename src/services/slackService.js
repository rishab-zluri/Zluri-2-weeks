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
 * Format execution result for concise Slack display
 * @param {string} resultStr - JSON string of execution result
 * @returns {Object} Formatted result with summary, preview, and error info
 */
/* istanbul ignore next */
const formatExecutionResult = (resultStr) => {
  try {
    const result = JSON.parse(resultStr);
    
    // Check if execution failed (success: false in result)
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
    
    // Build concise summary from various sources
    const parts = [];
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
    
    // Parse output array for more details
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
    if (totalRowsFetched > 0) {
      parts.push(`📊 ${totalRowsFetched} row(s) fetched`);
    }
    if (totalRowsAffected > 0) {
      parts.push(`✏️ ${totalRowsAffected} row(s) affected`);
    }
    if (totalDocs > 0) {
      parts.push(`📄 ${totalDocs} document(s) processed`);
    }
    if (totalQueries > 0) {
      parts.push(`🔍 ${totalQueries} query(ies) executed`);
    }
    if (totalOperations > 0) {
      parts.push(`⚙️ ${totalOperations} operation(s) completed`);
    }
    
    const summaryText = parts.length > 0 ? parts.join(' | ') : 'Execution completed';
    
    // Get data preview (first few rows)
    let preview = '';
    if (Array.isArray(output)) {
      const dataItems = output.filter(item => item.type === 'data');
      if (dataItems.length > 0 && dataItems[0].preview) {
        const rows = dataItems[0].preview.slice(0, 3);
        if (rows.length > 0) {
          preview = rows.map(row => {
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
    
    // For simple query results (direct rows)
    if (!preview && result.rows && Array.isArray(result.rows) && result.rows.length > 0) {
      const rows = result.rows.slice(0, 3);
      preview = rows.map(row => {
        const rowStr = JSON.stringify(row);
        return rowStr.length > 100 ? rowStr.substring(0, 97) + '...' : rowStr;
      }).join('\n');
      
      if (result.rows.length > 3) {
        preview += `\n... and ${result.rows.length - 3} more row(s)`;
      }
    }
    
    // Check result object for rows
    if (!preview && result.result?.rows && Array.isArray(result.result.rows) && result.result.rows.length > 0) {
      const rows = result.result.rows.slice(0, 3);
      preview = rows.map(row => {
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
};

/**
 * Format error for concise Slack display
 * @param {string} errorMessage - Error message or JSON string
 * @returns {Object} Formatted error with type, message, and line
 */
/* istanbul ignore next */
const formatErrorMessage = (errorMessage) => {
  try {
    // Try to parse as JSON (from script execution)
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
  
  // Extract error type from message
  let errorType = 'Error';
  let line = null;
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
    line = parseInt(lineMatch[1]);
  }
  
  return {
    type: errorType,
    message: cleanMessage,
    line,
  };
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
 * Get Slack user ID - either from request or by looking up email
 * @param {Object} request - Request object with slackUserId or userEmail
 * @returns {string|null} Slack user ID or null
 */
/* istanbul ignore next */
const getSlackUserId = async (request) => {
  // If we already have the Slack user ID, use it
  if (request.slackUserId) {
    return request.slackUserId;
  }
  
  // Try to look up by email
  if (request.userEmail) {
    return await lookupUserByEmail(request.userEmail);
  }
  
  return null;
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
    // Format result for concise display
    const formatted = formatExecutionResult(result);
    
    // If execution actually failed, send failure notification instead
    if (formatted.success === false) {
      let errorText = `*Error Type:* ${formatted.error.type}`;
      if (formatted.error.code) {
        errorText += ` (Code: ${formatted.error.code})`;
      }
      if (formatted.error.line) {
        errorText += ` at Line ${formatted.error.line}`;
      }
      errorText += `\n*Reason:* ${truncate(formatted.error.message, 300)}`;
      
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
            text: errorText,
          },
        },
      ];
      
      if (formatted.duration) {
        blocks.push({
          type: 'context',
          elements: [{
            type: 'mrkdwn',
            text: `⏱️ Duration: ${formatted.duration}ms`,
          }],
        });
      }

      const channelMessage = {
        channel: config.slack.approvalChannel,
        blocks,
        text: `Query #${request.id} execution failed`,
      };

      await slackClient.chat.postMessage(channelMessage);

      const slackUserId = await getSlackUserId(request);
      if (slackUserId) {
        await sendDirectMessage(slackUserId, channelMessage.blocks, channelMessage.text);
      }
      
      logger.info('Slack execution failure notification sent', { requestId: request.id });
      return;
    }
    
    // Success case
    const durationText = formatted.duration ? ` (${formatted.duration}ms)` : '';
    
    const blocks = [
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
          text: `*Summary:*\n${formatted.summary}${durationText}`,
        },
      },
    ];
    
    // Add preview only if there's data to show
    if (formatted.preview) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Preview:*\n\`\`\`${formatted.preview}\`\`\``,
        },
      });
    }

    // Send to approval channel
    const channelMessage = {
      channel: config.slack.approvalChannel,
      blocks,
      text: `Query #${request.id} executed successfully`,
    };

    await slackClient.chat.postMessage(channelMessage);

    // Send DM to requester - look up by email if slackUserId not set
    const slackUserId = await getSlackUserId(request);
    if (slackUserId) {
      await sendDirectMessage(slackUserId, channelMessage.blocks, channelMessage.text);
      logger.info('Sent DM to requester', { requestId: request.id, slackUserId });
    } else {
      logger.warn('Could not send DM - no Slack user ID found', { requestId: request.id, email: request.userEmail });
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
    // Format error for concise display
    const formatted = formatErrorMessage(errorMessage);
    
    let errorText = `*Error Type:* ${formatted.type}`;
    if (formatted.line) {
      errorText += ` (Line ${formatted.line})`;
    }
    errorText += `\n*Reason:* ${truncate(formatted.message, 300)}`;
    
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
          text: errorText,
        },
      },
    ];

    // Send to approval channel
    await slackClient.chat.postMessage({
      channel: config.slack.approvalChannel,
      blocks,
      text: `Query #${request.id} execution failed`,
    });

    // Send DM to requester - look up by email if slackUserId not set
    const slackUserId = await getSlackUserId(request);
    if (slackUserId) {
      await sendDirectMessage(slackUserId, blocks, `Query #${request.id} execution failed`);
      logger.info('Sent failure DM to requester', { requestId: request.id, slackUserId });
    } else {
      logger.warn('Could not send failure DM - no Slack user ID found', { requestId: request.id, email: request.userEmail });
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

    // Send DM to requester only - look up by email if slackUserId not set
    const slackUserId = await getSlackUserId(request);
    if (slackUserId) {
      await sendDirectMessage(slackUserId, blocks, `Query #${request.id} rejected`);
      logger.info('Sent rejection DM to requester', { requestId: request.id, slackUserId });
    } else {
      logger.warn('Could not send rejection DM - no Slack user ID found', { requestId: request.id, email: request.userEmail });
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