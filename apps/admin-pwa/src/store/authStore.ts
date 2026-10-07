import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { UserRole } from '@gomookambika/types';

interface User {
  id: string;
  name: string;
  phone: string;
  email?: string;
  role: UserRole;
  permissions?: string[];
  profilePhoto?: string;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

interface AuthState {
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  setAuth: (user: User, tokens: AuthTokens) => void;
  clearAuth: () => void;
  updateTokens: (tokens: AuthTokens) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      tokens: null,
      isAuthenticated: false,

      setAuth: (user, tokens) =>
        set({ user, tokens, isAuthenticated: true }),

      clearAuth: () =>
        set({ user: null, tokens: null, isAuthenticated: false }),

      updateTokens: (tokens) =>
        set(state => ({ ...state, tokens })),
    }),
    {
      name: 'gm-admin-auth',
      partialize: (state) => ({
        user: state.user,
        tokens: state.tokens,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
