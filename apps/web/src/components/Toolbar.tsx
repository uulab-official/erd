import { useState } from "react";
import { Button } from "@modelforge/ui";
import { useEditorStore } from "../store/useEditorStore.js";
import { useAuthStore } from "../store/useAuthStore.js";
import { downloadExport, exporters } from "../lib/exporters.js";

export function Toolbar() {
  const [entityName, setEntityName] = useState("");
  const [exporting, setExporting] = useState(false);
  const { model, canUndo, canRedo, saving, addEntity, undo, redo, save } = useEditorStore();
  const { user, logout } = useAuthStore();

  function handleAddEntity() {
    if (!entityName.trim()) return;
    addEntity(entityName.trim());
    setEntityName("");
  }

  async function handleExport(exporterId: string) {
    const exporter = exporters.find((e) => e.id === exporterId);
    if (!exporter) return;
    setExporting(true);
    try {
      await downloadExport(exporter, model);
    } finally {
      setExporting(false);
    }
  }

  return (
    <header className="flex items-center gap-2 border-b border-neutral-200 px-4 py-2">
      <h1 className="mr-2 text-lg font-semibold">ModelForge</h1>
      <span className="mr-4 text-sm text-neutral-500">{model.name}</span>

      <input
        value={entityName}
        onChange={(e) => setEntityName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleAddEntity()}
        placeholder="New entity name"
        className="w-40 rounded border border-neutral-300 px-2 py-1 text-sm"
      />
      <Button variant="secondary" onClick={handleAddEntity}>
        Add Entity
      </Button>

      <Button variant="ghost" onClick={undo} disabled={!canUndo}>
        Undo
      </Button>
      <Button variant="ghost" onClick={redo} disabled={!canRedo}>
        Redo
      </Button>

      <div className="ml-auto flex items-center gap-2">
        <select
          className="rounded border border-neutral-300 px-2 py-1 text-sm"
          disabled={exporting}
          value=""
          onChange={(e) => e.target.value && void handleExport(e.target.value)}
        >
          <option value="" disabled>
            {exporting ? "Exporting…" : "Export…"}
          </option>
          {exporters.map((exporter) => (
            <option key={exporter.id} value={exporter.id}>
              {exporter.label}
            </option>
          ))}
        </select>

        <Button variant="primary" onClick={() => void save()} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
        {user && (
          <>
            <span className="text-sm text-neutral-500">{user.email}</span>
            <Button variant="ghost" onClick={() => void logout()}>
              Logout
            </Button>
          </>
        )}
      </div>
    </header>
  );
}
