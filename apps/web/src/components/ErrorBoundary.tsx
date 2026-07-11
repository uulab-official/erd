import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@modelforge/ui";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

// Catches render/lifecycle errors anywhere below it in the tree so a single bad
// component (e.g. an unexpected data shape reaching Canvas/EntityInspector) blanks a
// fallback screen instead of the whole document — with no boundary, React unmounts the
// entire tree on an uncaught render error, silently losing any Model edits made since
// the last Save with nothing on screen telling the user what happened.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[ErrorBoundary] Caught a render error:", error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-white p-8 text-center">
        <h1 className="text-lg font-semibold text-slate-900">Something went wrong.</h1>
        <p className="max-w-md text-sm text-slate-500">
          {error.message || "An unexpected error occurred."} Reloading may recover your last saved
          state — unsaved changes since your last Save may be lost.
        </p>
        <Button variant="secondary" size="sm" onClick={() => window.location.reload()}>
          Reload
        </Button>
      </div>
    );
  }
}
