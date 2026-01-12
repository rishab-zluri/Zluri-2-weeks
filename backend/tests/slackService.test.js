/**
 * Slack Service Tests
 * Tests for Slack notification functionality
 */

// We need to set up mocks before requiring the module
const mockPostMessage = jest.fn().mockResolvedValue({ ok: true });
const mockLookupByEmail = jest.fn();
const mockConversationsOpen = jest.fn();
const mockAuthTest = jest.fn();

// Mock @slack/web-api before requiring anything that uses it
jest.mock('@slack/web-api', () => ({
  WebClient: jest.fn().mockImplementation(() => ({
    chat: {
      postMessage: mockPostMessage,
    },
    users: {
      lookupByEmail: mockLookupByEmail,
    },
    conversations: {
      open: mockConversationsOpen,
    },
    auth: {
      test: mockAuthTest,
    },
  })),
}));

// Mock config with Slack enabled
jest.mock('../src/config', () => ({
  slack: {
    enabled: true,
    botToken: 'xoxb-test-token',
    approvalChannel: 'C123456',
  },
  logging: {
    level: 'info',
  },
}));

// Now require the service after mocks are set up
const slackService = require('../src/services/slackService');

describe('Slack Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('isConfigured', () => {
    it('should return true when Slack is configured', () => {
      expect(slackService.isConfigured()).toBe(true);
    });
  });

  describe('notifyNewSubmission', () => {
    it('should send notification for new query submission', async () => {
      const request = {
        id: 1,
        userEmail: 'test@example.com',
        instanceName: 'Database 1',
        databaseType: 'postgresql',
        podName: 'Pod 1',
        comments: 'Test query',
        submissionType: 'query',
        queryContent: 'SELECT * FROM users',
      };

      await slackService.notifyNewSubmission(request);

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'C123456',
          blocks: expect.any(Array),
        })
      );
    });

    it('should send notification for new script submission', async () => {
      const request = {
        id: 1,
        userEmail: 'test@example.com',
        instanceName: 'Database 1',
        databaseType: 'postgresql',
        podName: 'Pod 1',
        comments: 'Test script',
        submissionType: 'script',
        scriptFilename: 'test.js',
      };

      await slackService.notifyNewSubmission(request);

      expect(mockPostMessage).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockPostMessage.mockRejectedValueOnce(new Error('Slack error'));

      const request = {
        id: 1,
        userEmail: 'test@example.com',
        instanceName: 'DB',
        databaseType: 'postgresql',
        podName: 'Pod 1',
        comments: 'Test',
        submissionType: 'query',
        queryContent: 'SELECT 1',
      };

      await expect(slackService.notifyNewSubmission(request)).resolves.not.toThrow();
    });
  });

  describe('notifyApprovalSuccess', () => {
    it('should send success notification to channel', async () => {
      const request = {
        id: 1,
        approverEmail: 'approver@example.com',
      };

      await slackService.notifyApprovalSuccess(request, '{"rows": []}');

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'C123456',
        })
      );
    });

    it('should send DM to requester when slackUserId exists', async () => {
      mockConversationsOpen.mockResolvedValueOnce({
        ok: true,
        channel: { id: 'D123' },
      });

      const request = {
        id: 1,
        approverEmail: 'approver@example.com',
        slackUserId: 'U123',
      };

      await slackService.notifyApprovalSuccess(request, '{"rows": []}');

      expect(mockConversationsOpen).toHaveBeenCalledWith({ users: 'U123' });
      expect(mockPostMessage).toHaveBeenCalledTimes(2);
    });

    it('should not send DM when slackUserId missing', async () => {
      const request = {
        id: 1,
        approverEmail: 'approver@example.com',
      };

      await slackService.notifyApprovalSuccess(request, '{}');

      expect(mockPostMessage).toHaveBeenCalledTimes(1);
    });

    it('should truncate large results', async () => {
      const request = {
        id: 1,
        approverEmail: 'approver@example.com',
      };

      const largeResult = 'x'.repeat(2000);
      await slackService.notifyApprovalSuccess(request, largeResult);

      expect(mockPostMessage).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockPostMessage.mockRejectedValueOnce(new Error('Slack error'));

      const request = { id: 1, approverEmail: 'test@test.com' };

      await expect(slackService.notifyApprovalSuccess(request, '{}')).resolves.not.toThrow();
    });
  });

  describe('notifyApprovalFailure', () => {
    it('should send failure notification to channel', async () => {
      const request = {
        id: 1,
        approverEmail: 'approver@example.com',
      };

      await slackService.notifyApprovalFailure(request, 'Query failed');

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'C123456',
        })
      );
    });

    it('should send DM to requester', async () => {
      mockConversationsOpen.mockResolvedValueOnce({
        ok: true,
        channel: { id: 'D123' },
      });

      const request = {
        id: 1,
        approverEmail: 'approver@example.com',
        slackUserId: 'U123',
      };

      await slackService.notifyApprovalFailure(request, 'Error message');

      expect(mockPostMessage).toHaveBeenCalledTimes(2);
    });

    it('should handle errors gracefully', async () => {
      mockPostMessage.mockRejectedValueOnce(new Error('Slack error'));

      const request = { id: 1, approverEmail: 'test@test.com' };

      await expect(slackService.notifyApprovalFailure(request, 'error')).resolves.not.toThrow();
    });
  });

  describe('notifyRejection', () => {
    it('should send rejection DM to requester', async () => {
      mockConversationsOpen.mockResolvedValueOnce({
        ok: true,
        channel: { id: 'D123' },
      });

      const request = {
        id: 1,
        approverEmail: 'approver@example.com',
        slackUserId: 'U123',
        submissionType: 'query',
        queryContent: 'SELECT 1',
      };

      await slackService.notifyRejection(request);

      expect(mockConversationsOpen).toHaveBeenCalledWith({ users: 'U123' });
    });

    it('should not send when slackUserId missing', async () => {
      const request = {
        id: 1,
        approverEmail: 'approver@example.com',
        submissionType: 'query',
        queryContent: 'SELECT 1',
      };

      await slackService.notifyRejection(request);

      expect(mockConversationsOpen).not.toHaveBeenCalled();
    });

    it('should include rejection reason when provided', async () => {
      mockConversationsOpen.mockResolvedValueOnce({
        ok: true,
        channel: { id: 'D123' },
      });

      const request = {
        id: 1,
        approverEmail: 'approver@example.com',
        slackUserId: 'U123',
        rejectionReason: 'Invalid query',
        submissionType: 'query',
        queryContent: 'DROP TABLE',
      };

      await slackService.notifyRejection(request);

      expect(mockPostMessage).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockConversationsOpen.mockRejectedValueOnce(new Error('Slack error'));

      const request = {
        id: 1,
        slackUserId: 'U123',
        approverEmail: 'test@test.com',
        submissionType: 'query',
        queryContent: 'SELECT 1',
      };

      await expect(slackService.notifyRejection(request)).resolves.not.toThrow();
    });
  });

  describe('sendDirectMessage', () => {
    it('should send DM successfully', async () => {
      mockConversationsOpen.mockResolvedValueOnce({
        ok: true,
        channel: { id: 'D123' },
      });

      await slackService.sendDirectMessage('U123', [{ type: 'section' }], 'Test');

      expect(mockConversationsOpen).toHaveBeenCalledWith({ users: 'U123' });
      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'D123',
        })
      );
    });

    it('should handle failed channel open', async () => {
      mockConversationsOpen.mockResolvedValueOnce({
        ok: false,
      });

      await expect(
        slackService.sendDirectMessage('U123', [], 'Test')
      ).resolves.not.toThrow();

      expect(mockPostMessage).not.toHaveBeenCalled();
    });
  });

  describe('lookupUserByEmail', () => {
    it('should return user ID when found', async () => {
      mockLookupByEmail.mockResolvedValueOnce({
        user: { id: 'U12345' },
      });

      const result = await slackService.lookupUserByEmail('test@example.com');

      expect(result).toBe('U12345');
    });

    it('should return null when user not found', async () => {
      mockLookupByEmail.mockRejectedValueOnce(new Error('User not found'));

      const result = await slackService.lookupUserByEmail('unknown@example.com');

      expect(result).toBeNull();
    });
  });

  describe('testConnection', () => {
    it('should return true on successful connection', async () => {
      mockAuthTest.mockResolvedValueOnce({
        team: 'Test Team',
      });

      const result = await slackService.testConnection();

      expect(result).toBe(true);
    });

    it('should return false on connection failure', async () => {
      mockAuthTest.mockRejectedValueOnce(new Error('Auth failed'));

      const result = await slackService.testConnection();

      expect(result).toBe(false);
    });
  });
});
