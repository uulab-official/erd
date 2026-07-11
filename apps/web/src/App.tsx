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
  const model = useEditorStore((state) => state.model);
  const savedModel = useEditorStore((state) => state.savedModel);
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

  // Every Operation returns a brand-new `model` object (see docs/operations.md — no
  // Operation mutates in place), and save()/load()/restore() all set `savedModel` to
  // that exact same reference, so `model !== savedModel` is a cheap, exact "has this
  // model been edited since the last save?" check with no need to diff the two. Without
  // this, closing the tab or reloading loses any in-progress edit with zero warning —
  // the in-app "Back to models" button already confirms unconditionally, but that only
  // covers in-app navigation, not the browser chrome closing/reloading the page.
  useEffect(() => {
    if (!openModelId || model === savedModel) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [openModelId, model, savedModel]);

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
