import { Response, Request } from 'express';
import {
    getAccessTokenCookieOptions,
    getRefreshTokenCookieOptions,
    getCsrfCookieOptions,
    setAccessTokenCookie,
    setRefreshTokenCookie,
    setCsrfTokenCookie,
    setAuthCookies,
    clearAuthCookies,
    extractAccessToken,
    extractRefreshToken,
    isUsingCookieAuth,
    COOKIE_NAMES
} from '../../src/utils/cookies';
import config from '../../src/config';

// Mock config
jest.mock('../../src/config', () => ({
    jwt: {
        expiresIn: '15m',
        refreshExpiresIn: '7d'
    },
    isProduction: false
}));

describe('Cookie Utilities', () => {
    let mockRes: Partial<Response>;
    let mockReq: Partial<Request>;

    beforeEach(() => {
        mockRes = {
            cookie: jest.fn(),
            clearCookie: jest.fn(),
        };
        mockReq = {
            cookies: {},
            headers: {},
            body: {}
        };
    });

    describe('Cookie Options', () => {
        it('should return correct access token options', () => {
            const options = getAccessTokenCookieOptions();
            expect(options.httpOnly).toBe(true);
            expect(options.path).toBe('/');
            expect(options.maxAge).toBe(15 * 60 * 1000); // 15m
        });

        it('should return correct refresh token options', () => {
            const options = getRefreshTokenCookieOptions();
            expect(options.httpOnly).toBe(true);
            expect(options.path).toBe('/');
            expect(options.maxAge).toBe(7 * 24 * 60 * 60 * 1000); // 7d
        });

        it('should return correct CSRF options', () => {
            const options = getCsrfCookieOptions();
            expect(options.httpOnly).toBe(false);
            expect(options.path).toBe('/');
        });
    });

    describe('Cookie Setters', () => {
        it('should set access token cookie', () => {
            setAccessTokenCookie(mockRes as Response, 'access-token');
            expect(mockRes.cookie).toHaveBeenCalledWith(
                COOKIE_NAMES.ACCESS_TOKEN,
                'access-token',
                expect.any(Object)
            );
        });

        it('should set refresh token cookie', () => {
            setRefreshTokenCookie(mockRes as Response, 'refresh-token');
            expect(mockRes.cookie).toHaveBeenCalledWith(
                COOKIE_NAMES.REFRESH_TOKEN,
                'refresh-token',
                expect.any(Object)
            );
        });

        it('should set CSRF token cookie', () => {
            setCsrfTokenCookie(mockRes as Response, 'csrf-token');
            expect(mockRes.cookie).toHaveBeenCalledWith(
                COOKIE_NAMES.CSRF_TOKEN,
                'csrf-token',
                expect.any(Object)
            );
        });

        it('should set all auth cookies', () => {
            setAuthCookies(mockRes as Response, 'access', 'refresh', 'csrf');
            expect(mockRes.cookie).toHaveBeenCalledTimes(3);
        });

        it('should set auth cookies without csrf', () => {
            setAuthCookies(mockRes as Response, 'access', 'refresh');
            expect(mockRes.cookie).toHaveBeenCalledTimes(2);
        });
    });

    describe('Cookie Clearing', () => {
        it('should clear all auth cookies', () => {
            clearAuthCookies(mockRes as Response);
            expect(mockRes.clearCookie).toHaveBeenCalledWith(COOKIE_NAMES.ACCESS_TOKEN, expect.any(Object));
            expect(mockRes.clearCookie).toHaveBeenCalledWith(COOKIE_NAMES.REFRESH_TOKEN, expect.any(Object));
            expect(mockRes.clearCookie).toHaveBeenCalledWith(COOKIE_NAMES.CSRF_TOKEN, expect.any(Object));
        });
    });

    describe('Extractors', () => {
        describe('extractAccessToken', () => {
            it('should prioritize cookie', () => {
                mockReq.cookies = { [COOKIE_NAMES.ACCESS_TOKEN]: 'cookie-token' };
                mockReq.headers = { authorization: 'Bearer header-token' };

                const token = extractAccessToken(mockReq as any);
                expect(token).toBe('cookie-token');
            });

            it('should fallback to header', () => {
                mockReq.cookies = {};
                mockReq.headers = { authorization: 'Bearer header-token' };

                const token = extractAccessToken(mockReq as any);
                expect(token).toBe('header-token');
            });

            it('should return null if neither present', () => {
                const token = extractAccessToken(mockReq as any);
                expect(token).toBeNull();
            });

            it('should ignore non-Bearer header', () => {
                mockReq.headers = { authorization: 'Basic user:pass' };
                const token = extractAccessToken(mockReq as any);
                expect(token).toBeNull();
            });
        });

        describe('extractRefreshToken', () => {
            it('should prioritize cookie', () => {
                mockReq.cookies = { [COOKIE_NAMES.REFRESH_TOKEN]: 'cookie-token' };
                mockReq.body = { refreshToken: 'body-token' };

                const token = extractRefreshToken(mockReq as any);
                expect(token).toBe('cookie-token');
            });

            it('should fallback to body', () => {
                mockReq.cookies = {};
                mockReq.body = { refreshToken: 'body-token' };

                const token = extractRefreshToken(mockReq as any);
                expect(token).toBe('body-token');
            });

            it('should return null if neither present', () => {
                const token = extractRefreshToken(mockReq as any);
                expect(token).toBeNull();
            });
        });

        describe('isUsingCookieAuth', () => {
            it('should return true if access token cookie exists', () => {
                mockReq.cookies = { [COOKIE_NAMES.ACCESS_TOKEN]: 'yes' };
                expect(isUsingCookieAuth(mockReq as any)).toBe(true);
            });

            it('should return false if cookie missing', () => {
                mockReq.cookies = {};
                expect(isUsingCookieAuth(mockReq as any)).toBe(false);
            });
        });
    });
});

describe('Production Config', () => {
    beforeEach(() => {
        jest.resetModules();
    });

    it('should return secure options in production', async () => {
        jest.doMock('../../src/config', () => ({
            jwt: { expiresIn: '15m', refreshExpiresIn: '7d' },
            isProduction: true
        }));

        const { getAccessTokenCookieOptions, COOKIE_NAMES } = await import('../../src/utils/cookies');

        const options = getAccessTokenCookieOptions();
        expect(options.secure).toBe(true);
        expect(COOKIE_NAMES.ACCESS_TOKEN).toContain('__Host-');
    });
});

