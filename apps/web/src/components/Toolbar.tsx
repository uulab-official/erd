import { useRef, useState } from "react";
import { Button, Input, Select } from "@modelforge/ui";
import { useEditorStore } from "../store/useEditorStore.js";
import { useAuthStore } from "../store/useAuthStore.js";
import { useNavigationStore } from "../store/useNavigationStore.js";
import { downloadExport, exporters } from "../lib/exporters.js";
import { downloadGenerated, generators } from "../lib/generators.js";
import { layoutEngines } from "../lib/layouts.js";
import { importAppwriteJsonFile } from "../lib/importAppwrite.js";
import { importTextFile } from "../lib/importText.js";
import { canDeploy, importLiveAppwriteSchema } from "../lib/appwrite.js";

function Divider() {
  return <div className="mx-1 h-6 w-px bg-slate-200" />;
}

export function Toolbar() {
  const [entityName, setEntityName] = useState("");
  const [exporting, setExporting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importingLive, setImportingLive] = useState(false);
  // Export/Generate/Auto-layout previously had no error handling at all — a rejection
  // (a generator throwing on unexpected model data, an auto-layout engine failing on a
  // pathological graph, the browser's download API being blocked) went nowhere but the
  // console, same silent-failure shape as the save()/load()/Version-panel gaps fixed
  // earlier this pass. handleLayout in particular had no loading state to even revert,
  // so a failure there previously looked like nothing happened at all.
  const [actionError, setActionError] = useState<string | null>(null);
  const [layingOut, setLayingOut] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    model,
    canUndo,
    canRedo,
    saving,
    saveError,
    addEntity,
    undo,
    redo,
    save,
    importModel,
    applyLayout,
    createMemo,
  } = useEditorStore();
  const { user, logout, error: authError } = useAuthStore();
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

  function handleAddMemo() {
    // Offset each new memo slightly so stacking several doesn't hide them under one
    // another — a lightweight version of the cascade offset other tools use for pasted
    // items. The user drags it wherever they actually want it.
    const offset = ((model.memos?.length ?? 0) % 6) * 24;
    createMemo({
      id: crypto.randomUUID(),
      text: "",
      x: 40 + offset,
      y: 40 + offset,
    });
  }

  async function handleExport(exporterId: string) {
    const exporter = exporters.find((e) => e.id === exporterId);
    if (!exporter) return;
    setExporting(true);
    setActionError(null);
    try {
      await downloadExport(exporter, model);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    } finally {
      setExporting(false);
    }
  }

  async function handleGenerate(generatorId: string) {
    const generator = generators.find((g) => g.id === generatorId);
    if (!generator) return;
    setGenerating(true);
    setActionError(null);
    try {
      await downloadGenerated(generator, model);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    } finally {
      setGenerating(false);
    }
  }

  async function handleLayout(engineId: string) {
    const engine = layoutEngines.find((l) => l.id === engineId);
    if (!engine) return;
    setLayingOut(true);
    setActionError(null);
    try {
      const positions = await engine.layout(model);
      applyLayout(positions, `Layout: ${engine.label}`);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    } finally {
      setLayingOut(false);
    }
  }

  async function handleImportFile(file: File | undefined) {
    if (!file) return;
    setImportError(null);
    try {
      if (file.name.toLowerCase().endsWith(".json")) {
        importModel(await importAppwriteJsonFile(file));
      } else {
        // Text formats (DBML/Mermaid) describe schema, not identity — keep editing the
        // same Model document (id/name/adapter) so Save still writes where it did.
        const imported = await importTextFile(file);
        importModel({ ...imported, id: model.id, name: model.name, adapter: model.adapter });
      }
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
    <header className="flex items-center gap-1.5 border-b border-slate-200 bg-white px-3 py-2">
      <Button variant="ghost" size="sm" onClick={handleBackToModels}>
        ← Models
      </Button>
      <span className="mr-1 truncate text-sm font-semibold text-slate-900">{model.name}</span>
      <Divider />

      <Input
        value={entityName}
        onChange={(e) => setEntityName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleAddEntity()}
        placeholder="New entity name"
        className="w-40"
      />
      <Button variant="secondary" size="sm" onClick={handleAddEntity}>
        Add Entity
      </Button>
      <Button variant="ghost" size="sm" onClick={handleAddMemo}>
        Add Memo
      </Button>

      <Divider />
      <Button variant="ghost" size="sm" onClick={undo} disabled={!canUndo}>
        Undo
      </Button>
      <Button variant="ghost" size="sm" onClick={redo} disabled={!canRedo}>
        Redo
      </Button>

      <Divider />
      <Select
        disabled={layingOut}
        value=""
        onChange={(e) => e.target.value && void handleLayout(e.target.value)}
      >
        <option value="" disabled>
          {layingOut ? "Laying out…" : "Layout…"}
        </option>
        {layoutEngines.map((engine) => (
          <option key={engine.id} value={engine.id}>
            {engine.label}
          </option>
        ))}
      </Select>

      <Divider />
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.dbml,.mmd,.mermaid"
        className="hidden"
        onChange={(e) => {
          void handleImportFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()}>
        Import
      </Button>
      {canDeploy && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void handleImportLive()}
          disabled={importingLive}
        >
          {importingLive ? "Importing…" : "Import Live"}
        </Button>
      )}
      {importError && (
        <span className="max-w-xs truncate text-sm text-red-600" title={importError}>
          {importError}
        </span>
      )}
      {actionError && (
        <span className="max-w-xs truncate text-sm text-red-600" title={actionError} role="alert">
          {actionError}
        </span>
      )}

      <div className="ml-auto flex items-center gap-2">
        <Select
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
        </Select>

        <Select
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
        </Select>

        <Button variant="primary" size="sm" onClick={() => void save()} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
        {saveError && (
          <span className="text-sm text-red-600" role="alert">
            Save failed: {saveError}
          </span>
        )}
        {user && (
          <>
            <Divider />
            <span className="text-sm text-slate-500">{user.email}</span>
            <Button variant="ghost" size="sm" onClick={() => void logout()}>
              Logout
            </Button>
            {authError && (
              <span className="max-w-xs truncate text-sm text-red-600" role="alert">
                Logout failed: {authError}
              </span>
            )}
          </>
        )}
      </div>
    </header>
  );
}
