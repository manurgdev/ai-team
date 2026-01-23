import { useEffect } from 'react';
import { useAuthStore } from '../store/auth-store';
import { authApi } from '../lib/api/auth';
import { RegisterDto, LoginDto } from '../lib/types/api.types';
import { toast } from 'sonner';

export const useAuth = () => {
  const { user, token, isAuthenticated, isLoading, login, logout, initialize, setLoading } =
    useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  const handleRegister = async (data: RegisterDto) => {
    try {
      setLoading(true);
      const response = await authApi.register(data);
      login(response.user, response.token);
      toast.success('Registration successful!');
      return { success: true };
    } catch (error: any) {
      const message = error.response?.data?.error || 'Registration failed';
      toast.error(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (data: LoginDto) => {
    try {
      setLoading(true);
      const response = await authApi.login(data);
      login(response.user, response.token);
      toast.success('Login successful!');
      return { success: true };
    } catch (error: any) {
      const message = error.response?.data?.error || 'Login failed';
      toast.error(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await authApi.logout();
      logout();
      toast.success('Logged out successfully');
    } catch (error) {
      logout();
    }
  };

  return {
    user,
    token,
    isAuthenticated,
    isLoading,
    register: handleRegister,
    login: handleLogin,
    logout: handleLogout,
  };
};
