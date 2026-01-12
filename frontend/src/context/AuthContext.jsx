import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import authService from '../services/authService';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Initialize auth state from localStorage
  useEffect(() => {
    const initAuth = async () => {
      try {
        const storedUser = authService.getStoredUser();
        const token = localStorage.getItem('accessToken');

        if (storedUser && token) {
          // Verify token by fetching profile
          try {
            const response = await authService.getProfile();
            setUser(response.data);
            setIsAuthenticated(true);
          } catch (error) {
            // Token invalid - clear auth
            await authService.logout();
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

  const login = useCallback(async (email, password) => {
    const response = await authService.login(email, password);
    
    if (response.success) {
      authService.storeAuth(response.data);
      setUser(response.data.user);
      setIsAuthenticated(true);
      return { success: true };
    }
    
    return { success: false, error: response.message || 'Login failed' };
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    setUser(null);
    setIsAuthenticated(false);
  }, []);

  const updateUser = useCallback((userData) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
  }, []);

  const value = {
    user,
    loading,
    isAuthenticated,
    login,
    logout,
    updateUser,
    // Helper getters
    isManager: user?.role === 'manager' || user?.role === 'admin',
    isAdmin: user?.role === 'admin',
    isDeveloper: user?.role === 'developer',
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
