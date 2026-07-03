import type { Relationship } from "@modelforge/schema-engine";
import { Button, Input, Select } from "@modelforge/ui";
import { useEditorStore } from "../store/useEditorStore.js";
import { useSelectionStore } from "../store/useSelectionStore.js";

const CARDINALITIES: Relationship["cardinality"][] = ["one-to-one", "one-to-many", "many-to-many"];
const KINDS: Relationship["kind"][] = ["identifying", "non-identifying"];
const OPTIONALITIES: Relationship["optionality"][] = ["mandatory", "optional"];
const FK_ACTIONS: NonNullable<Relationship["onDelete"]>[] = [
  "cascade",
  "restrict",
  "set-null",
  "no-action",
];

const CARDINALITY_LABEL: Record<Relationship["cardinality"], string> = {
  "one-to-one": "1 : 1",
  "one-to-many": "1 : N",
  "many-to-many": "N : N",
};

export function RelationshipInspector() {
  const selectedRelationshipId = useSelectionStore((state) => state.selectedRelationshipId);
  const selectRelationship = useSelectionStore((state) => state.selectRelationship);
  const {
    model,
    changeRelationshipCardinality,
    changeRelationshipKind,
    setRelationshipMeta,
    deleteRelationship,
  } = useEditorStore();

  const relationship = model.relationships.find((r) => r.id === selectedRelationshipId);
  if (!relationship) return null;

  const entityName = (entityId: string) =>
    model.entities.find((e) => e.id === entityId)?.logicalName ?? entityId;

  function handleDelete() {
    if (!relationship) return;
    // Deleting only removes the Relationship — the FK attribute connectEntitiesCascade
    // generated on the target stays (it may hold data / be referenced elsewhere); the
    // user can remove it from the Entity Inspector if it's truly unwanted.
    if (!window.confirm("Delete this relationship? The FK attribute is kept.")) return;
    deleteRelationship(relationship.id);
    selectRelationship(null);
  }

  return (
    <aside className="flex h-full w-80 flex-col overflow-y-auto border-l border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-900">Relationship</h2>
        <button
          className="text-slate-400 hover:text-slate-600"
          onClick={() => selectRelationship(null)}
          aria-label="Close inspector"
        >
          ✕
        </button>
      </div>

      <div className="border-b border-slate-200 p-4 text-sm text-slate-700">
        <span className="font-medium">{entityName(relationship.sourceEntityId)}</span>
        <span className="mx-1.5 text-slate-400">
          → {CARDINALITY_LABEL[relationship.cardinality]} →
        </span>
        <span className="font-medium">{entityName(relationship.targetEntityId)}</span>
      </div>

      <div className="flex flex-col gap-3 p-4">
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
          Name
          <Input
            key={`${relationship.id}-name`}
            defaultValue={relationship.name ?? ""}
            placeholder="e.g. places, contains"
            onBlur={(e) =>
              setRelationshipMeta(relationship.id, { name: e.target.value.trim() || undefined })
            }
          />
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
          Cardinality
          <Select
            value={relationship.cardinality}
            onChange={(e) =>
              changeRelationshipCardinality(
                relationship.id,
                e.target.value as Relationship["cardinality"],
              )
            }
          >
            {CARDINALITIES.map((c) => (
              <option key={c} value={c}>
                {CARDINALITY_LABEL[c]} ({c})
              </option>
            ))}
          </Select>
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
          Kind
          <Select
            value={relationship.kind}
            onChange={(e) =>
              changeRelationshipKind(relationship.id, e.target.value as Relationship["kind"])
            }
          >
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </Select>
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
          Optionality
          <Select
            value={relationship.optionality}
            onChange={(e) =>
              setRelationshipMeta(relationship.id, {
                optionality: e.target.value as Relationship["optionality"],
              })
            }
          >
            {OPTIONALITIES.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </Select>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
            On delete
            <Select
              value={relationship.onDelete ?? ""}
              onChange={(e) =>
                setRelationshipMeta(relationship.id, {
                  onDelete: (e.target.value || undefined) as Relationship["onDelete"],
                })
              }
            >
              <option value="">(default)</option>
              {FK_ACTIONS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </Select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
            On update
            <Select
              value={relationship.onUpdate ?? ""}
              onChange={(e) =>
                setRelationshipMeta(relationship.id, {
                  onUpdate: (e.target.value || undefined) as Relationship["onUpdate"],
                })
              }
            >
              <option value="">(default)</option>
              {FK_ACTIONS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </Select>
          </label>
        </div>

        <Button variant="danger" size="sm" onClick={handleDelete}>
          Delete Relationship
        </Button>
      </div>
    </aside>
  );
}
