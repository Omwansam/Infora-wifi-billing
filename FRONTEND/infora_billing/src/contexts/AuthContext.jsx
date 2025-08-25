import React, { createContext, useContext, useState, useEffect } from 'react';
import { API_ENDPOINTS, getAuthHeaders } from '../config/api';
import { apiCall, authenticatedApiCall } from '../utils/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for stored user data
    const storedUser = localStorage.getItem('infora_user');
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);

        // Verify token is still valid
        verifyToken(parsedUser.access_token).catch(() => {
          // If token verification fails, try refreshing
          if (parsedUser.refresh_token) {
            refreshToken(parsedUser.refresh_token).catch(() => {
              // If refresh fails, logout
              logout();
            });
          } else {
            logout();
          }
        });
      } catch (error) {
        localStorage.removeItem('infora_user');
      }
    }
    setLoading(false);
  }, []);

  const verifyToken = async (token) => {
    if (!token) return false;
    
    const result = await authenticatedApiCall(API_ENDPOINTS.VERIFY, token);
    return result.success;
  };

  const refreshToken = async (refreshTokenValue) => {
    const result = await authenticatedApiCall(API_ENDPOINTS.REFRESH, refreshTokenValue, {
      method: 'POST'
    });

    if (result.success) {
      const updatedUser = user ? {
        ...user,
        access_token: result.data.access_token
      } : null;

      if (updatedUser) {
        setUser(updatedUser);
        localStorage.setItem('infora_user', JSON.stringify(updatedUser));
      }
      return true;
    }
    return false;
  };

  const login = async (email, password) => {
    setLoading(true);

    const result = await apiCall(API_ENDPOINTS.LOGIN, {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (result.success && result.data.success) {
      const userData = {
        id: result.data.user.id.toString(),
        email: result.data.user.email,
        first_name: result.data.user.first_name,
        last_name: result.data.user.last_name,
        role: result.data.user.role,
        is_admin: result.data.user.is_admin,
        access_token: result.data.access_token,
        refresh_token: result.data.refresh_token
      };

      setUser(userData);
      localStorage.setItem('infora_user', JSON.stringify(userData));
      // Backward compatibility for modules reading from 'token'
      localStorage.setItem('token', result.data.access_token);
      if (userData.is_admin) {
        localStorage.setItem('adminToken', result.data.access_token);
        localStorage.setItem('adminRefreshToken', result.data.refresh_token);
      }
      setLoading(false);
      return { success: true, user: userData };
    }

    setLoading(false);
    return { success: false, error: result.error || result.data?.error || 'Login failed' };
  };

  const register = async (userData) => {
    setLoading(true);

    const result = await apiCall(API_ENDPOINTS.REGISTER, {
      method: 'POST',
      body: JSON.stringify(userData),
    });

    if (result.success && result.data.success) {
      // Auto login after successful registration
      return await login(userData.email, userData.password);
    }

    setLoading(false);
    return { success: false, error: result.error || result.data?.error || 'Registration failed' };
  };

  const logout = async () => {
    // Call backend logout endpoint if user is logged in
    if (user?.access_token) {
      try {
        await authenticatedApiCall(API_ENDPOINTS.LOGOUT, user.access_token, {
          method: 'POST'
        });
      } catch (error) {
        console.error('Logout API call failed:', error);
      }
    }
    
    setUser(null);
    localStorage.removeItem('infora_user');
    localStorage.removeItem('token');
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminRefreshToken');
  };

  const isAdmin = () => {
    return user?.is_admin === true;
  };

  return (
    <AuthContext.Provider value={{
      user,
      login,
      register,
      logout,
      loading,
      isAdmin,
      refreshToken: async () => {
        if (!user?.refresh_token) return false;
        return refreshToken(user.refresh_token);
      }
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

