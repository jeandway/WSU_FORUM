/**
 * Updated AuthContext - Works with Django Backend
 * ================================================
 * Key changes:
 * 1. Uses 'accessToken' instead of 'auth_token'
 * 2. Handles Django's response format
 * 3. Properly maps user data
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';

// ============================================================================
// CONTEXT
// ============================================================================

const AuthContext = createContext(null);

// ============================================================================
// PROVIDER
// ============================================================================

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check for existing session on mount
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      api.auth.getMe()
        .then(({ user }) => {
          if (user) {
            setUser(user);
          } else {
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
          }
        })
        .catch(() => {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  // Sign in with email/password
  const signIn = useCallback(async (email, password) => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.auth.signIn(email, password);
      
      if (result.success && result.user) {
        setUser(result.user);
        return { success: true };
      } else {
        throw new Error(result.message || 'Sign in failed');
      }
    } catch (err) {
      const errorMessage = err.message || 'Sign in failed';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, []);

  // Sign in with SSO (Wayne State)
  const signInSSO = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.auth.signInWithSSO();
      if (result.user) {
        setUser(result.user);
      }
      return { success: true };
    } catch (err) {
      setError(err.message || 'SSO sign in failed');
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, []);

  // Sign up
  const signUp = useCallback(async (data) => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.auth.signUp(data);
      
      // Don't set user - they need to verify email first
      return { 
        success: true, 
        message: result.message || 'Please check your email to verify your account'
      };
    } catch (err) {
      const errorMessage = err.message || 'Sign up failed';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, []);

  // Sign out
  const signOut = useCallback(async () => {
    setLoading(true);
    try {
      await api.auth.signOut();
    } catch {
      // Ignore errors, still sign out locally
    } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      setUser(null);
      setLoading(false);
    }
  }, []);

  // Verify email
  const verifyEmail = useCallback(async (code) => {
    setLoading(true);
    setError(null);
    try {
      await api.auth.verifyEmail(code);
      return { success: true };
    } catch (err) {
      setError(err.message || 'Verification failed');
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, []);

  // Update user profile locally
  const updateUser = useCallback((updates) => {
    setUser((prev) => (prev ? { ...prev, ...updates } : null));
  }, []);

  // Clear error
  const clearError = useCallback(() => setError(null), []);

  const value = {
    user,
    loading,
    error,
    isAuthenticated: !!user,
    signIn,
    signInSSO,
    signUp,
    signOut,
    verifyEmail,
    updateUser,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ============================================================================
// HOOK
// ============================================================================

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
