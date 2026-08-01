import { create } from 'zustand';

interface User {
  id: string;
  username: string;
  avatar: string | null;
  global_name: string | null;
  is_admin?: boolean;
}

interface AuthState {
  user: User | null;
  status: 'checking' | 'authenticated' | 'anonymous';
  isAuthReady: boolean;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
  setChecking: () => void;
  setAnonymous: () => void;
  logout: () => void;
}

// Remove credentials written by the legacy URL-token flow. Browser sessions
// now live only in a Secure, HttpOnly cookie owned by api.acosmibot.com.
(() => {
  try {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('discord_token');
  } catch { /* storage may be unavailable */ }
})();

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: 'checking',
  isAuthReady: false,
  isAuthenticated: false,
  setUser: (user) => set({
    user,
    status: user ? 'authenticated' : 'anonymous',
    isAuthReady: true,
    isAuthenticated: !!user,
  }),
  setChecking: () => set({ status: 'checking', isAuthReady: false }),
  setAnonymous: () => set({
    user: null,
    status: 'anonymous',
    isAuthReady: true,
    isAuthenticated: false,
  }),
  logout: () => set({
    user: null,
    status: 'anonymous',
    isAuthReady: true,
    isAuthenticated: false,
  }),
}));
