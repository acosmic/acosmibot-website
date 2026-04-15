import { create } from 'zustand';

interface User {
  id: string;
  username: string;
  avatar: string | null;
  global_name: string | null;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  logout: () => void;
}

// Read from either key — the old vanilla dashboard stores as 'discord_token'
const storedToken = (() => {
  try {
    return localStorage.getItem('auth_token') || localStorage.getItem('discord_token');
  } catch {
    return null;
  }
})();

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: storedToken,
  isAuthenticated: !!storedToken,
  setUser: (user) => set({ user }),
  setToken: (token) => {
    if (token) {
      localStorage.setItem('auth_token', token);
      localStorage.setItem('discord_token', token); // keep old dashboard in sync
    } else {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('discord_token');
    }
    set({ token, isAuthenticated: !!token });
  },
  logout: () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('discord_token');
    set({ user: null, token: null, isAuthenticated: false });
  },
}));
