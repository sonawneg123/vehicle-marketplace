import React, { createContext, useContext, useState, useCallback } from 'react';
import { api } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('rewheel_user');
    return stored ? JSON.parse(stored) : null;
  });

  const persist = (token, userData) => {
    localStorage.setItem('rewheel_token', token);
    localStorage.setItem('rewheel_user', JSON.stringify(userData));
    setUser(userData);
  };

  const login = useCallback(async (identifier, password) => {
    const data = await api.post('/auth/login', { identifier, password });
    persist(data.token, data.user);
    return data.user;
  }, []);

  const signup = useCallback(async (payload) => {
    const data = await api.post('/auth/signup', payload);
    persist(data.token, data.user);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('rewheel_token');
    localStorage.removeItem('rewheel_user');
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
