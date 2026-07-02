import { useEffect, useRef } from "react";
import { LoginScreen } from "./components/LoginScreen.js";
import { Workspace } from "./components/Workspace.js";
import { Dashboard } from "./components/Dashboard.js";
import { useAuthStore } from "./store/useAuthStore.js";
import { useNavigationStore } from "./store/useNavigationStore.js";
import { useEditorStore } from "./store/useEditorStore.js";
import { isAppwriteConfigured } from "./lib/appwrite.js";

export function App() {
  const { user, loading, checkSession } = useAuthStore();
  const openModelId = useNavigationStore((state) => state.openModelId);
  const load = useEditorStore((state) => state.load);
  // A page refresh restores openModelId from localStorage before the editor's model has
  // actually been fetched — load it once so Workspace doesn't render the still-empty
  // "default" model under the previously-open model's id.
  const restoredModelId = useRef<string | null>(null);

  useEffect(() => {
    if (isAppwriteConfigured) void checkSession();
  }, [checkSession]);

  useEffect(() => {
    if (openModelId && restoredModelId.current !== openModelId) {
      restoredModelId.current = openModelId;
      void load(openModelId);
    }
  }, [openModelId, load]);

  if (isAppwriteConfigured && loading) {
    return (
      <div className="flex h-screen items-center justify-center text-neutral-400">Loading…</div>
    );
  }

  if (isAppwriteConfigured && !user) {
    return <LoginScreen />;
  }

  if (!openModelId) {
    return <Dashboard />;
  }

  return <Workspace />;
}
