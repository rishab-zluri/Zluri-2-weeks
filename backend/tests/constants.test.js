/**
 * Constants Tests
 * Test auth constants and enums
 */

const { TokenType, UserRole, SessionStatus } = require('../src/constants/auth');
const constants = require('../src/constants');

describe('Auth Constants', () => {
  describe('TokenType', () => {
    it('should have ACCESS type', () => {
      expect(TokenType.ACCESS).toBe('access');
    });

    it('should have REFRESH type', () => {
      expect(TokenType.REFRESH).toBe('refresh');
    });

    it('should be frozen (immutable)', () => {
      expect(Object.isFrozen(TokenType)).toBe(true);
    });
  });

  describe('UserRole', () => {
    it('should have ADMIN role', () => {
      expect(UserRole.ADMIN).toBe('admin');
    });

    it('should have MANAGER role', () => {
      expect(UserRole.MANAGER).toBe('manager');
    });

    it('should have DEVELOPER role', () => {
      expect(UserRole.DEVELOPER).toBe('developer');
    });

    it('should be frozen (immutable)', () => {
      expect(Object.isFrozen(UserRole)).toBe(true);
    });
  });

  describe('SessionStatus', () => {
    it('should have ACTIVE status', () => {
      expect(SessionStatus.ACTIVE).toBe('active');
    });

    it('should have REVOKED status', () => {
      expect(SessionStatus.REVOKED).toBe('revoked');
    });

    it('should have EXPIRED status', () => {
      expect(SessionStatus.EXPIRED).toBe('expired');
    });

    it('should be frozen (immutable)', () => {
      expect(Object.isFrozen(SessionStatus)).toBe(true);
    });
  });
});

describe('Constants Index', () => {
  it('should export TokenType', () => {
    expect(constants.TokenType).toBeDefined();
    expect(constants.TokenType.ACCESS).toBe('access');
  });

  it('should export UserRole', () => {
    expect(constants.UserRole).toBeDefined();
    expect(constants.UserRole.ADMIN).toBe('admin');
  });

  it('should export SessionStatus', () => {
    expect(constants.SessionStatus).toBeDefined();
    expect(constants.SessionStatus.ACTIVE).toBe('active');
  });
});
