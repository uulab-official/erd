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
    try {
      const user = await auth.currentUser();
      set({ user, loading: false });
    } catch (error) {
      // A network blip (or any other transient failure) here must not leave `loading`
      // stuck at true forever — App.tsx renders a full-screen "Loading…" for as long as
      // it's true, so an unhandled rejection here would soft-lock the entire app on
      // startup with no escape but a hard refresh. Falls back to "not logged in" (safe
      // default — LoginScreen), logged to the console for debugging rather than shown
      // to the user, since this isn't a user action that failed.
      console.error("[auth] Failed to check session:", error);
      set({ user: null, loading: false });
    }
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
    try {
      await auth.logout();
      set({ user: null, error: null });
    } catch (error) {
      set({ error: messageOf(error) });
    }
  },
}));
