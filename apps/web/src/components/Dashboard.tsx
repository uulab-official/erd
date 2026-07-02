import { useEffect, useState } from "react";
import { Button } from "@modelforge/ui";
import { newModelId } from "@modelforge/api";
import { useModelListStore } from "../store/useModelListStore.js";
import { useNavigationStore } from "../store/useNavigationStore.js";
import { useEditorStore } from "../store/useEditorStore.js";

function formatUpdatedAt(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
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
    <div className="mx-auto flex h-screen max-w-3xl flex-col gap-4 overflow-y-auto p-8">
      <h1 className="text-xl font-semibold">Your Models</h1>

      <div className="flex gap-2">
        <input
          value={newModelName}
          onChange={(e) => setNewModelName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void handleCreate()}
          placeholder="New model name"
          className="flex-1 rounded border border-neutral-300 px-3 py-2 text-sm"
        />
        <Button
          variant="primary"
          onClick={() => void handleCreate()}
          disabled={creating || !newModelName.trim()}
        >
          {creating ? "Creating…" : "New Model"}
        </Button>
      </div>

      {loading && <p className="text-sm text-neutral-500">Loading…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!loading && !error && ordered.length === 0 && (
        <p className="text-sm text-neutral-500">No models yet — create one above to get started.</p>
      )}

      <ul className="flex flex-col gap-2">
        {ordered.map((m) => (
          <li
            key={m.id}
            className="flex items-center gap-3 rounded border border-neutral-200 px-3 py-2"
          >
            <button
              type="button"
              onClick={() => toggleFavorite(m.id)}
              aria-label={favoriteModelIds.has(m.id) ? "Unfavorite" : "Favorite"}
              className={favoriteModelIds.has(m.id) ? "text-amber-500" : "text-neutral-300"}
            >
              ★
            </button>
            <div className="flex-1">
              <div className="text-sm font-medium">{m.name}</div>
              <div className="text-xs text-neutral-500">Updated {formatUpdatedAt(m.updatedAt)}</div>
            </div>
            <Button variant="secondary" onClick={() => void handleOpen(m.id)}>
              Open
            </Button>
            <Button variant="danger" onClick={() => void handleDelete(m.id, m.name)}>
              Delete
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
