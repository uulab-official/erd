import { useEffect, useState } from "react";
import { Button, Card, Input } from "@modelforge/ui";
import { newModelId } from "@modelforge/api";
import { useModelListStore } from "../store/useModelListStore.js";
import { useNavigationStore } from "../store/useNavigationStore.js";
import { useEditorStore } from "../store/useEditorStore.js";

function formatUpdatedAt(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill={filled ? "currentColor" : "none"}>
      <path
        d="M10 1.5l2.6 5.27 5.82.85-4.21 4.1 1 5.79L10 14.9l-5.2 2.73 1-5.79-4.2-4.1 5.81-.85L10 1.5z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Dashboard() {
  const { models, loading, error, refresh, remove } = useModelListStore();
  const { favoriteModelIds, toggleFavorite, openModel } = useNavigationStore();
  const { newModel, load, save } = useEditorStore();
  const [newModelName, setNewModelName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleOpen(modelId: string) {
    openModel(modelId);
    await load(modelId);
  }

  async function handleCreate() {
    const name = newModelName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const id = newModelId();
      newModel(id, name);
      await save();
      setNewModelName("");
      openModel(id);
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(modelId: string, name: string) {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
    await remove(modelId);
  }

  // Favorites first (alphabetical), then everything else in the store's own order
  // (most-recently-updated first — see ModelStore.list()).
  const favorites = models.filter((m) => favoriteModelIds.has(m.id));
  favorites.sort((a, b) => a.name.localeCompare(b.name));
  const rest = models.filter((m) => !favoriteModelIds.has(m.id));
  const ordered = [...favorites, ...rest];

  return (
    <div className="h-screen overflow-y-auto bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-8 py-4">
        <div className="mx-auto flex max-w-3xl items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-600">
            <div className="grid grid-cols-2 gap-0.5">
              <div className="h-1.5 w-1.5 rounded-[1px] bg-white" />
              <div className="h-1.5 w-1.5 rounded-[1px] bg-white/55" />
              <div className="h-1.5 w-1.5 rounded-[1px] bg-white/55" />
              <div className="h-1.5 w-1.5 rounded-[1px] bg-white" />
            </div>
          </div>
          <span className="font-semibold tracking-tight text-slate-900">ModelForge</span>
        </div>
      </header>

      <div className="mx-auto flex max-w-3xl flex-col gap-5 p-8">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Your Models</h1>
          <p className="text-sm text-slate-500">Pick up where you left off, or start fresh.</p>
        </div>

        <div className="flex gap-2">
          <Input
            value={newModelName}
            onChange={(e) => setNewModelName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void handleCreate()}
            placeholder="New model name"
            className="flex-1"
          />
          <Button
            variant="primary"
            onClick={() => void handleCreate()}
            disabled={creating || !newModelName.trim()}
          >
            {creating ? "Creating…" : "New Model"}
          </Button>
        </div>

        {loading && <p className="text-sm text-slate-500">Loading…</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
        {!loading && !error && ordered.length === 0 && (
          <Card className="border-dashed p-8 text-center">
            <p className="text-sm text-slate-500">
              No models yet — create one above to get started.
            </p>
          </Card>
        )}

        <ul className="flex flex-col gap-2">
          {ordered.map((m) => (
            <li key={m.id}>
              <Card className="flex items-center gap-3 p-3 transition-shadow hover:shadow-sm">
                <button
                  type="button"
                  onClick={() => toggleFavorite(m.id)}
                  aria-label={favoriteModelIds.has(m.id) ? "Unfavorite" : "Favorite"}
                  className={
                    favoriteModelIds.has(m.id)
                      ? "text-amber-500"
                      : "text-slate-300 hover:text-slate-400"
                  }
                >
                  <StarIcon filled={favoriteModelIds.has(m.id)} />
                </button>
                <div className="flex-1">
                  <div className="text-sm font-medium text-slate-900">{m.name}</div>
                  <div className="text-xs text-slate-500">
                    Updated {formatUpdatedAt(m.updatedAt)}
                  </div>
                </div>
                <Button variant="secondary" size="sm" onClick={() => void handleOpen(m.id)}>
                  Open
                </Button>
                <Button variant="danger" size="sm" onClick={() => void handleDelete(m.id, m.name)}>
                  Delete
                </Button>
              </Card>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
