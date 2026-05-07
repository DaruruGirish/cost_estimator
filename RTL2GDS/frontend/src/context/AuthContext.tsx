import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { UserRole } from '../types';
import { apiService } from '../services/api';

interface AuthContextType {
  userRole: UserRole | null;
  userEmail: string | null;
  userName: string | null;
  register: (name: string, email: string, password: string, role: UserRole) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [userRole, setUserRole] = useState<UserRole | null>(() => {
    const stored = localStorage.getItem('rtlgds_user_role');
    return (stored as UserRole) || null;
  });
  const [userEmail, setUserEmail] = useState<string | null>(() => {
    return localStorage.getItem('rtlgds_user_email');
  });
  const [userName, setUserName] = useState<string | null>(() => {
    return localStorage.getItem('rtlgds_user_name');
  });
  const [loading, setLoading] = useState(false);

  const register = async (name: string, email: string, password: string, role: UserRole) => {
    try {
      setLoading(true);
      const data = await apiService.register(name, email, password, role);
      console.log('Registration API response:', data);
      
      // Ensure role is properly set - normalize to lowercase and validate
      const returnedRole = data.role?.toLowerCase();
      const userRole: UserRole = (returnedRole === 'admin' || returnedRole === 'customer') 
        ? returnedRole as UserRole 
        : role;
      
      // Update state immediately - this will trigger App re-render
      setUserRole(userRole);
      setUserEmail(data.email || email);
      setUserName(data.name || name);
      
      // Double-check localStorage is set (apiService should have done this, but ensure it)
      if (localStorage.getItem('rtlgds_user_role') !== userRole) {
        localStorage.setItem('rtlgds_user_role', userRole);
      }
      if (localStorage.getItem('rtlgds_user_email') !== (data.email || email)) {
        localStorage.setItem('rtlgds_user_email', data.email || email);
      }
      if (data.name && localStorage.getItem('rtlgds_user_name') !== data.name) {
        localStorage.setItem('rtlgds_user_name', data.name);
      }
      
      console.log('Registration successful, role set to:', userRole, 'State updated');
    } catch (error: any) {
      console.error('Registration failed:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      setLoading(true);
      const data = await apiService.login(email, password);
      // Ensure role is properly set - normalize to lowercase
      const userRole = (data.role?.toLowerCase() as UserRole);
      // Update state immediately - this will trigger App re-render
      setUserRole(userRole);
      setUserEmail(data.email || email);
      setUserName(data.name || null);
      
      // Ensure name is stored in localStorage if it exists
      if (data.name && localStorage.getItem('rtlgds_user_name') !== data.name) {
        localStorage.setItem('rtlgds_user_name', data.name);
      }
      
      console.log('Login successful, role set to:', userRole, 'name:', data.name);
    } catch (error: any) {
      console.error('Login failed:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setUserRole(null);
    setUserEmail(null);
    setUserName(null);
    localStorage.removeItem('rtlgds_user_role');
    localStorage.removeItem('auth_token');
    localStorage.removeItem('rtlgds_user_email');
    localStorage.removeItem('rtlgds_user_name');
  };

  // Sync userName from localStorage on mount
  useEffect(() => {
    const storedName = localStorage.getItem('rtlgds_user_name');
    if (storedName && !userName) {
      setUserName(storedName);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ userRole, userEmail, userName, register, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

