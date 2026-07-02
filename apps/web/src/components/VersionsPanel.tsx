import { useEffect, useState } from "react";
import type { Model } from "@modelforge/schema-engine";
import { diffModels } from "@modelforge/diff-engine";
import { useEditorStore } from "../store/useEditorStore.js";

function formatCreatedAt(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
}

export function VersionsPanel() {
  const {
    model,
    versions,
    versionsLoading,
    refreshVersions,
    saveVersion,
    restoreVersion,
    deleteVersion,
    getVersionSnapshot,
  } = useEditorStore();
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [compareId, setCompareId] = useState<string | null>(null);
  const [compareSnapshot, setCompareSnapshot] = useState<Model | null>(null);
  const [compareError, setCompareError] = useState<string | null>(null);

  useEffect(() => {
    void refreshVersions();
  }, [refreshVersions]);

  async function handleSave() {
    if (!label.trim()) return;
    setSaving(true);
    try {
      await saveVersion(label.trim());
      setLabel("");
    } finally {
      setSaving(false);
    }
  }

  async function handleCompare(versionId: string) {
    if (compareId === versionId) {
      setCompareId(null);
      setCompareSnapshot(null);
      return;
    }
    setCompareError(null);
    setCompareId(versionId);
    setCompareSnapshot(null);
    try {
      const snapshot = await getVersionSnapshot(versionId);
      setCompareSnapshot(snapshot);
    } catch (error) {
      setCompareError(error instanceof Error ? error.message : String(error));
    }
  }

  async function handleRestore(versionId: string, label: string) {
    if (
      !window.confirm(
        `Restore "${label}"? This replaces the current model. Unsaved changes will be lost unless you've saved.`,
      )
    ) {
      return;
    }
    await restoreVersion(versionId);
  }

  async function handleDelete(versionId: string, label: string) {
    if (!window.confirm(`Delete version "${label}"? This cannot be undone.`)) return;
    if (compareId === versionId) {
      setCompareId(null);
      setCompareSnapshot(null);
    }
    await deleteVersion(versionId);
  }

  const compareDiff = compareSnapshot ? diffModels(compareSnapshot, model) : null;
  const compareDiffCount = compareDiff
    ? compareDiff.added.length + compareDiff.removed.length + compareDiff.changed.length
    : 0;

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex gap-2">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void handleSave()}
          placeholder="Version label (e.g. v1 - initial schema)"
          className="flex-1 rounded border border-neutral-300 px-2 py-1 text-sm"
        />
        <button
          className="rounded bg-neutral-800 px-3 py-1 text-sm text-white disabled:opacity-50"
          onClick={() => void handleSave()}
          disabled={saving || !label.trim()}
        >
          {saving ? "Saving…" : "Save Version"}
        </button>
      </div>

      {versionsLoading && <p className="text-neutral-400">Loading…</p>}
      {!versionsLoading && versions.length === 0 && (
        <p className="text-neutral-400">
          No versions saved yet — save one above to create a restorable snapshot.
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {versions.map((version) => (
          <li key={version.id} className="rounded border border-neutral-200 p-2">
            <div className="flex items-center gap-2">
              <span className="font-medium">{version.label}</span>
              <span className="text-xs text-neutral-500">{formatCreatedAt(version.createdAt)}</span>
              <div className="ml-auto flex gap-2">
                <button className="hover:underline" onClick={() => void handleCompare(version.id)}>
                  {compareId === version.id ? "Hide" : "Compare"}
                </button>
                <button
                  className="hover:underline"
                  onClick={() => void handleRestore(version.id, version.label)}
                >
                  Restore
                </button>
                <button
                  className="text-red-600 hover:underline"
                  onClick={() => void handleDelete(version.id, version.label)}
                >
                  Delete
                </button>
              </div>
            </div>

            {compareId === version.id && (
              <div className="ml-4 mt-2 text-xs">
                {compareError && <p className="text-red-600">{compareError}</p>}
                {!compareError && !compareSnapshot && <p className="text-neutral-400">Loading…</p>}
                {compareDiff && compareDiffCount === 0 && (
                  <p className="text-neutral-400">No changes since this version.</p>
                )}
                {compareDiff && (
                  <ul>
                    {compareDiff.added.map((name) => (
                      <li key={`added-${name}`} className="text-green-700">
                        + {name} created
                      </li>
                    ))}
                    {compareDiff.removed.map((name) => (
                      <li key={`removed-${name}`} className="text-red-600">
                        - {name} deleted
                      </li>
                    ))}
                    {compareDiff.changed.map((name) => (
                      <li key={`changed-${name}`} className="text-amber-600">
                        ~ {name} changed
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
