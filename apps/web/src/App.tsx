import { useEffect } from "react";
import { LoginScreen } from "./components/LoginScreen.js";
import { Workspace } from "./components/Workspace.js";
import { useAuthStore } from "./store/useAuthStore.js";
import { isAppwriteConfigured } from "./lib/appwrite.js";

export function App() {
  const { user, loading, checkSession } = useAuthStore();

  useEffect(() => {
    if (isAppwriteConfigured) void checkSession();
  }, [checkSession]);

  if (isAppwriteConfigured && loading) {
    return (
      <div className="flex h-screen items-center justify-center text-neutral-400">Loading…</div>
    );
  }

  if (isAppwriteConfigured && !user) {
    return <LoginScreen />;
  }

  return <Workspace />;
}
