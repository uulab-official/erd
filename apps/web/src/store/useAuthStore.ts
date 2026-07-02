import { create } from "zustand";
import type { Models } from "@modelforge/api";
import { getAuthService } from "../lib/appwrite.js";

interface AuthState {
  user: Models.User<Models.Preferences> | null;
  loading: boolean;
  error: string | null;
  checkSession(): Promise<void>;
  login(email: string, password: string): Promise<void>;
  signup(email: string, password: string, name?: string): Promise<void>;
  logout(): Promise<void>;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: false,
  error: null,

  async checkSession() {
    const auth = getAuthService();
    if (!auth) return;
    set({ loading: true });
    const user = await auth.currentUser();
    set({ user, loading: false });
  },

  async login(email, password) {
    const auth = getAuthService();
    if (!auth) {
      set({ error: "Appwrite is not configured — see .env.example" });
      return;
    }
    set({ loading: true, error: null });
    try {
      await auth.login(email, password);
      set({ user: await auth.currentUser(), loading: false });
    } catch (error) {
      set({ error: messageOf(error), loading: false });
    }
  },

  async signup(email, password, name) {
    const auth = getAuthService();
    if (!auth) {
      set({ error: "Appwrite is not configured — see .env.example" });
      return;
    }
    set({ loading: true, error: null });
    try {
      await auth.signup(email, password, name);
      await auth.login(email, password);
      set({ user: await auth.currentUser(), loading: false });
    } catch (error) {
      set({ error: messageOf(error), loading: false });
    }
  },

  async logout() {
    const auth = getAuthService();
    if (!auth) return;
    await auth.logout();
    set({ user: null });
  },
}));
