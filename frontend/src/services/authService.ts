import client, { ApiResponse } from '@/api/client';
import { User } from '@/types';

// Auth Response Types
interface AuthResponse {
  user: User;
  accessToken?: string; // Optional because Cookies are primary now
  refreshToken?: string;
  expiresIn?: number;
}

interface LoginResponse extends ApiResponse<AuthResponse> { }

interface ProfileInput {
  name?: string;
  picture?: string;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: User;
}

/**
 * Authentication Service
 * Handles all authentication-related API calls
 */
const authService = {
  /**
   * Login with email and password
   */
  async login(email: string, password: string): Promise<LoginResponse> {
    const response = await client.post<LoginResponse>('/api/auth/login', { email, password });
    return response.data;
  },

  /**
   * Logout the current user
   */
  async logout(): Promise<void> {
    try {
      await client.post('/api/auth/logout');
    } catch (error) {
      // Ignore logout errors - simply clear local state
    }
    // Clear local storage fallbacks if any (Cookie is primary)
    localStorage.removeItem('user');
  },

  /**
   * Get current user profile
   */
  async getProfile(): Promise<ApiResponse<User>> {
    const response = await client.get<ApiResponse<User>>('/api/auth/profile');
    return response.data;
  },

  /**
   * Update user profile
   */
  async updateProfile(data: ProfileInput): Promise<ApiResponse<User>> {
    const response = await client.put<ApiResponse<User>>('/api/auth/profile', data);
    return response.data;
  },

  /**
   * Change password
   */
  async changePassword(currentPassword: string, newPassword: string): Promise<ApiResponse<null>> {
    const response = await client.put<ApiResponse<null>>('/api/auth/password', {
      currentPassword,
      newPassword,
    });
    return response.data;
  },

  /**
   * Check if user *might* be authenticated (quick check)
   * Real auth check happens via getProfile() call
   */
  isAuthenticated(): boolean {
    // With httpOnly cookies, we can't check the token directly.
    // We rely on the User object in local storage or the context state.
    // This is just a helper for initial route rendering.
    return !!localStorage.getItem('user');
  },

  /**
   * Get stored user data (cache)
   */
  getStoredUser(): User | null {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  },

  /**
   * Store auth data (User object + Tokens)
   * Storing tokens in localStorage to support Header-Based Auth (Cross-Domain Fix)
   */
  storeAuth(data: Partial<AuthTokens>) {
    console.log('[AuthService] Storing Auth Data:', {
      hasUser: !!data.user,
      hasAccess: !!data.accessToken,
      hasRefresh: !!data.refreshToken
    });

    // Cache User
    if (data.user) {
      localStorage.setItem('user', JSON.stringify(data.user));
    }
    // Cache Tokens
    if (data.accessToken) {
      localStorage.setItem('accessToken', data.accessToken);
    }
    if (data.refreshToken) {
      localStorage.setItem('refreshToken', data.refreshToken);
    }
  },

  /**
   * Get Access Token
   */
  getAccessToken(): string | null {
    return localStorage.getItem('accessToken');
  },

  /**
   * Get Refresh Token
   */
  getRefreshToken(): string | null {
    return localStorage.getItem('refreshToken');
  },

  /**
   * Clear local auth state
   */
  clearAuth(): void {
    localStorage.removeItem('user');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  },
};

export default authService;
