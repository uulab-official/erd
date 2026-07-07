import { useState } from "react";
import type { ColumnType } from "@modelforge/schema-engine";
import { Button, Input, Select } from "@modelforge/ui";
import { useEditorStore } from "../store/useEditorStore.js";
import { useSelectionStore } from "../store/useSelectionStore.js";

const COLUMN_TYPES: ColumnType[] = [
  "string",
  "integer",
  "bigint",
  "float",
  "boolean",
  "datetime",
  "json",
  "enum",
  "uuid",
];

function toPhysicalName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, "_") || "attribute";
}

export function EntityInspector() {
  const selectedEntityId = useSelectionStore((state) => state.selectedEntityId);
  const selectEntity = useSelectionStore((state) => state.selectEntity);
  const {
    model,
    renameEntity,
    removeEntity,
    addAttribute,
    removeAttribute,
    renameAttribute,
    changeAttributeType,
    setAttributeFlags,
    setAttributeComment,
    assignDomain,
    unassignDomain,
    createIndex,
    deleteIndex,
  } = useEditorStore();
  const [newAttributeName, setNewAttributeName] = useState("");
  const [newIndexName, setNewIndexName] = useState("");
  const [newIndexAttributeIds, setNewIndexAttributeIds] = useState<string[]>([]);
  const [newIndexUnique, setNewIndexUnique] = useState(false);

  const entity = model.entities.find((e) => e.id === selectedEntityId);
  if (!entity) return null;

  const domains = model.domains ?? [];

  function handleAddAttribute() {
    const name = newAttributeName.trim();
    if (!name || !entity) return;
    addAttribute(entity.id, {
      id: crypto.randomUUID(),
      name: toPhysicalName(name),
      logicalName: name,
      type: "string",
      nullable: true,
      isPrimaryKey: false,
      isForeignKey: false,
      isUnique: false,
    });
    setNewAttributeName("");
  }

  function toggleNewIndexAttribute(attributeId: string) {
    setNewIndexAttributeIds((ids) =>
      ids.includes(attributeId) ? ids.filter((id) => id !== attributeId) : [...ids, attributeId],
    );
  }

  function handleCreateIndex() {
    if (!entity || newIndexAttributeIds.length === 0) return;
    const attributeNames = newIndexAttributeIds.map(
      (id) => entity.attributes.find((a) => a.id === id)?.name ?? id,
    );
    const name = newIndexName.trim() || `idx_${entity.physicalName}_${attributeNames.join("_")}`;
    createIndex(entity.id, {
      id: crypto.randomUUID(),
      name,
      attributeIds: newIndexAttributeIds,
      unique: newIndexUnique,
    });
    setNewIndexName("");
    setNewIndexAttributeIds([]);
    setNewIndexUnique(false);
  }

  function handleDeleteEntity() {
    if (!entity) return;
    if (!window.confirm(`Delete entity "${entity.logicalName}"? This cannot be undone.`)) return;
    removeEntity(entity.id);
    selectEntity(null);
  }

  return (
    <aside className="flex h-full w-80 flex-col overflow-y-auto border-l border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-900">Entity</h2>
        <button
          className="text-slate-400 hover:text-slate-600"
          onClick={() => selectEntity(null)}
          aria-label="Close inspector"
        >
          ✕
        </button>
      </div>

      <div className="flex flex-col gap-3 border-b border-slate-200 p-4">
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
          Logical name
          <Input
            key={`${entity.id}-logical`}
            defaultValue={entity.logicalName}
            onBlur={(e) => renameEntity(entity.id, { logicalName: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
          Physical name
          <Input
            key={`${entity.id}-physical`}
            defaultValue={entity.physicalName}
            className="font-mono"
            onBlur={(e) => renameEntity(entity.id, { physicalName: e.target.value })}
          />
        </label>
        <Button variant="danger" size="sm" onClick={handleDeleteEntity}>
          Delete Entity
        </Button>
      </div>

      <div className="flex flex-col gap-3 p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Attributes</h3>

        <div className="flex flex-col gap-2">
          {entity.attributes.map((attribute) => (
            <div
              key={attribute.id}
              className="flex flex-col gap-2 rounded-lg border border-slate-200 p-2.5"
            >
              <div className="flex gap-2">
                <Input
                  key={`${attribute.id}-name`}
                  defaultValue={attribute.name}
                  className="flex-1"
                  onBlur={(e) => renameAttribute(entity.id, attribute.id, { name: e.target.value })}
                />
                <Select
                  value={attribute.type}
                  onChange={(e) =>
                    changeAttributeType(entity.id, attribute.id, e.target.value as ColumnType)
                  }
                >
                  {COLUMN_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>
                <button
                  className="text-red-600 hover:underline"
                  onClick={() => removeAttribute(entity.id, attribute.id)}
                  aria-label={`Delete attribute ${attribute.name}`}
                >
                  ✕
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={attribute.isPrimaryKey}
                    onChange={(e) =>
                      setAttributeFlags(entity.id, attribute.id, {
                        isPrimaryKey: e.target.checked,
                      })
                    }
                  />
                  PK
                </label>
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={attribute.isForeignKey}
                    onChange={(e) =>
                      setAttributeFlags(entity.id, attribute.id, {
                        isForeignKey: e.target.checked,
                      })
                    }
                  />
                  FK
                </label>
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={attribute.isUnique}
                    onChange={(e) =>
                      setAttributeFlags(entity.id, attribute.id, { isUnique: e.target.checked })
                    }
                  />
                  Unique
                </label>
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={attribute.nullable}
                    onChange={(e) =>
                      setAttributeFlags(entity.id, attribute.id, { nullable: e.target.checked })
                    }
                  />
                  Nullable
                </label>
              </div>

              {domains.length > 0 && (
                <Select
                  value={attribute.domainId ?? ""}
                  onChange={(e) =>
                    e.target.value
                      ? assignDomain(entity.id, attribute.id, e.target.value)
                      : unassignDomain(entity.id, attribute.id)
                  }
                >
                  <option value="">No domain</option>
                  {domains.map((domain) => (
                    <option key={domain.id} value={domain.id}>
                      {domain.name}
                    </option>
                  ))}
                </Select>
              )}

              <Input
                key={`${attribute.id}-comment`}
                defaultValue={attribute.comment ?? ""}
                placeholder="Comment (data dictionary note, also emitted as a SQL column comment)"
                className="text-xs"
                onBlur={(e) =>
                  setAttributeComment(entity.id, attribute.id, e.target.value || undefined)
                }
              />
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <Input
            value={newAttributeName}
            onChange={(e) => setNewAttributeName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddAttribute()}
            placeholder="New attribute name"
            className="flex-1"
          />
          <Button variant="secondary" size="sm" onClick={handleAddAttribute}>
            Add
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-slate-200 p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Indexes</h3>

        <div className="flex flex-col gap-2">
          {entity.indexes.map((index) => (
            <div
              key={index.id}
              className="flex items-start justify-between gap-2 rounded-lg border border-slate-200 p-2.5"
            >
              <div className="flex flex-col gap-0.5 text-xs">
                <span className="font-mono font-medium text-slate-900">{index.name}</span>
                <span className="text-slate-500">
                  {index.attributeIds
                    .map((id) => entity.attributes.find((a) => a.id === id)?.name ?? id)
                    .join(", ")}
                  {index.unique ? " · unique" : ""}
                </span>
              </div>
              <button
                className="text-red-600 hover:underline"
                onClick={() => deleteIndex(entity.id, index.id)}
                aria-label={`Delete index ${index.name}`}
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2 rounded-lg border border-dashed border-slate-300 p-2.5">
          <Input
            value={newIndexName}
            onChange={(e) => setNewIndexName(e.target.value)}
            placeholder="Index name (optional)"
          />
          <div className="flex flex-col gap-1 text-xs text-slate-600">
            {entity.attributes.map((attribute) => (
              <label key={attribute.id} className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={newIndexAttributeIds.includes(attribute.id)}
                  onChange={() => toggleNewIndexAttribute(attribute.id)}
                />
                {attribute.name}
              </label>
            ))}
          </div>
          <label className="flex items-center gap-1.5 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={newIndexUnique}
              onChange={(e) => setNewIndexUnique(e.target.checked)}
            />
            Unique
          </label>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleCreateIndex}
            disabled={newIndexAttributeIds.length === 0}
          >
            Add index
          </Button>
        </div>
      </div>
    </aside>
  );
}
