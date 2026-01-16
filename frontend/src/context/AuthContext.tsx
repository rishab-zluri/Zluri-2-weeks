import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import authService from '../services/authService';
import { User, UserRole } from '@/types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateUser: (userData: User) => void;
  // Role Helpers
  isManager: boolean;
  isAdmin: boolean;
  isDeveloper: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Initialize auth state from localStorage/API
  useEffect(() => {
    const initAuth = async () => {
      try {
        const storedUser = authService.getStoredUser();

        // We generally assume if we have a user in local storage, we MIGHT be logged in
        // Ideally we check the cookie presence, but we can't read httpOnly cookies.
        // So we attempt to fetch the profile.
        if (storedUser) {
          try {
            const response = await authService.getProfile();
            if (response.success && response.data) {
              setUser(response.data);
              setIsAuthenticated(true);
            } else {
              throw new Error('Profile fetch failed');
            }
          } catch (error) {
            // Profile fetch failed - could be expired token or network error
            // Just clear local state, don't call logout API (which would revoke refresh token)
            // The Axios interceptor already tried to refresh the token
            authService.clearAuth();
            setUser(null);
            setIsAuthenticated(false);
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const response = await authService.login(email, password);

      if (response.success) {
        // Store minimal user info
        authService.storeAuth({ user: response.data.user });

        setUser(response.data.user);
        setIsAuthenticated(true);
        return { success: true };
      }

      return { success: false, error: response.message || 'Login failed' };
    } catch (err: any) {
      return { success: false, error: err?.response?.data?.message || err.message || 'Login failed' };
    }
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    setUser(null);
    setIsAuthenticated(false);
  }, []);

  const updateUser = useCallback((userData: User) => {
    setUser(userData);
    authService.storeAuth({ user: userData });
  }, []);

  const value: AuthContextType = {
    user,
    loading,
    isAuthenticated,
    login,
    logout,
    updateUser,
    // Helper getters
    isManager: user?.role === UserRole.MANAGER || user?.role === UserRole.ADMIN,
    isAdmin: user?.role === UserRole.ADMIN,
    isDeveloper: !user || user.role === UserRole.USER, // Default or specific user role
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
