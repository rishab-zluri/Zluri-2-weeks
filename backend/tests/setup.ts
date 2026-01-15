/**
 * Jest Test Setup
 * Configures the testing environment for backend tests
 */

import { jest, beforeAll, afterAll, afterEach } from '@jest/globals';

// Set test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-testing';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key';
process.env.JWT_EXPIRES_IN = '1h';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
process.env.PORT = '5001';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.SLACK_BOT_TOKEN = 'xoxb-test-token';
process.env.SLACK_APPROVAL_CHANNEL = 'C123456';
process.env.SCRIPT_TIMEOUT_MS = '5000';

// Mock Slack API
jest.mock('@slack/web-api', () => ({
    WebClient: jest.fn().mockImplementation(() => ({
        chat: {
            postMessage: jest.fn().mockResolvedValue({ ok: true } as never),
        },
        users: {
            lookupByEmail: jest.fn().mockResolvedValue({
                ok: true,
                user: { id: 'U12345' },
            } as never),
        },
        conversations: {
            open: jest.fn().mockResolvedValue({
                ok: true,
                channel: { id: 'D12345' },
            } as never),
        },
        auth: {
            test: jest.fn().mockResolvedValue({
                ok: true,
                team: 'Test Team',
            } as never),
        },
    })),
}));

// Mock console methods to reduce noise during tests
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleLog = console.log;

beforeAll(() => {
    console.error = jest.fn();
    console.warn = jest.fn();
    console.log = jest.fn();
});

afterAll(() => {
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
    console.log = originalConsoleLog;
});

// Clear all mocks between tests
afterEach(() => {
    jest.clearAllMocks();
});

// Set test timeout
jest.setTimeout(15000);
