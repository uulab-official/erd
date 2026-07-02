import { useRef, useState } from "react";
import { Button } from "@modelforge/ui";
import { useEditorStore } from "../store/useEditorStore.js";
import { useAuthStore } from "../store/useAuthStore.js";
import { useNavigationStore } from "../store/useNavigationStore.js";
import { downloadExport, exporters } from "../lib/exporters.js";
import { downloadGenerated, generators } from "../lib/generators.js";
import { importAppwriteJsonFile } from "../lib/importAppwrite.js";
import { canDeploy, importLiveAppwriteSchema } from "../lib/appwrite.js";

export function Toolbar() {
  const [entityName, setEntityName] = useState("");
  const [exporting, setExporting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importingLive, setImportingLive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { model, canUndo, canRedo, saving, addEntity, undo, redo, save, importModel } =
    useEditorStore();
  const { user, logout } = useAuthStore();
  const closeModel = useNavigationStore((state) => state.closeModel);

  function handleBackToModels() {
    if (
      window.confirm(
        "Back to your models list? Any unsaved changes to this model will be lost unless you've saved.",
      )
    ) {
      closeModel();
    }
  }

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

  async function handleGenerate(generatorId: string) {
    const generator = generators.find((g) => g.id === generatorId);
    if (!generator) return;
    setGenerating(true);
    try {
      await downloadGenerated(generator, model);
    } finally {
      setGenerating(false);
    }
  }

  async function handleImportFile(file: File | undefined) {
    if (!file) return;
    setImportError(null);
    try {
      const imported = await importAppwriteJsonFile(file);
      importModel(imported);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : String(error));
    }
  }

  async function handleImportLive() {
    if (
      !window.confirm(
        "This replaces the current model with the live schema from your Appwrite project. Unsaved changes will be lost. Continue?",
      )
    ) {
      return;
    }
    setImportError(null);
    setImportingLive(true);
    try {
      const imported = await importLiveAppwriteSchema();
      importModel(imported);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : String(error));
    } finally {
      setImportingLive(false);
    }
  }

  return (
    <header className="flex items-center gap-2 border-b border-neutral-200 px-4 py-2">
      <h1 className="mr-2 text-lg font-semibold">ModelForge</h1>
      <Button variant="ghost" onClick={handleBackToModels}>
        ← Models
      </Button>
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

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={(e) => {
          void handleImportFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <Button variant="ghost" onClick={() => fileInputRef.current?.click()}>
        Import
      </Button>
      {canDeploy && (
        <Button variant="ghost" onClick={() => void handleImportLive()} disabled={importingLive}>
          {importingLive ? "Importing…" : "Import Live"}
        </Button>
      )}
      {importError && (
        <span className="max-w-xs truncate text-sm text-red-600" title={importError}>
          {importError}
        </span>
      )}

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

        <select
          className="rounded border border-neutral-300 px-2 py-1 text-sm"
          disabled={generating}
          value=""
          onChange={(e) => e.target.value && void handleGenerate(e.target.value)}
        >
          <option value="" disabled>
            {generating ? "Generating…" : "Generate…"}
          </option>
          {generators.map((generator) => (
            <option key={generator.id} value={generator.id}>
              {generator.label}
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
