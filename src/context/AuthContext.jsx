import { createContext, useContext, useState, useCallback } from 'react';
import api from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(() => JSON.parse(localStorage.getItem('user') || 'null'));
  const [balance, setBalance] = useState(user?.currentBalance || 0);

  const login = useCallback((token, userData) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
    setBalance(userData.currentBalance);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  }, []);

  const refreshBalance = useCallback(async () => {
    try {
      const res = await api.get('/trading/balance');
      setBalance(parseFloat(res.data.data.current_balance));
    } catch {}
  }, []);

  return (
    <AuthContext.Provider value={{ user, balance, login, logout, refreshBalance }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
