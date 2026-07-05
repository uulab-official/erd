import { Handle, Position, type NodeProps } from "reactflow";
import type { Domain, Entity, EnumType } from "@modelforge/schema-engine";

export interface EntityNodeData {
  entity: Entity;
  // Only the EnumTypes this entity's attributes could reference — enough to resolve an
  // enum-typed attribute's linked name for display without threading the whole Model in.
  enums: EnumType[];
  // Same idea for Domain-governed attributes — shows which Domain an attribute belongs
  // to (e.g. "Email"), the diagram-visibility counterpart to Governance's Domain tab.
  domains: Domain[];
}

const HANDLE_CLASS = "!h-2 !w-2 !border !border-slate-400 !bg-white";

// The one real node the Canvas renders — an entity box showing its logical/physical name
// and every attribute, with small PK/FK tags. Handles on all four sides so a relationship
// can attach from whichever direction reads best given where the two entities end up.
export function EntityNode({ data, selected }: NodeProps<EntityNodeData>) {
  const { entity, enums, domains } = data;

  return (
    <div
      className={[
        "w-56 overflow-hidden rounded-lg border bg-white shadow-sm transition-shadow",
        selected ? "border-brand-500 ring-2 ring-brand-100" : "border-slate-300",
      ].join(" ")}
    >
      <Handle type="target" id="left" position={Position.Left} className={HANDLE_CLASS} />
      <Handle type="source" id="right" position={Position.Right} className={HANDLE_CLASS} />
      <Handle type="target" id="top" position={Position.Top} className={HANDLE_CLASS} />
      <Handle type="source" id="bottom" position={Position.Bottom} className={HANDLE_CLASS} />

      <div className="border-b border-slate-200 bg-slate-50 px-3 py-2">
        <div className="truncate text-sm font-semibold text-slate-900">{entity.logicalName}</div>
        <div className="truncate font-mono text-[11px] text-slate-400">{entity.physicalName}</div>
      </div>

      <ul className="divide-y divide-slate-100">
        {entity.attributes.length === 0 && (
          <li className="px-3 py-2 text-xs text-slate-400">No attributes</li>
        )}
        {entity.attributes.map((attribute) => (
          <li key={attribute.id} className="flex items-center gap-1.5 px-3 py-1.5 text-xs">
            {attribute.isPrimaryKey && (
              <span className="rounded bg-brand-100 px-1 py-0.5 text-[10px] font-semibold leading-none text-brand-700">
                PK
              </span>
            )}
            {attribute.isForeignKey && (
              <span className="rounded bg-slate-100 px-1 py-0.5 text-[10px] font-semibold leading-none text-slate-600">
                FK
              </span>
            )}
            <span
              className={
                "truncate " +
                (attribute.isPrimaryKey ? "font-medium text-slate-900" : "text-slate-700")
              }
            >
              {attribute.name}
            </span>
            <span className="ml-auto flex shrink-0 items-baseline gap-1 text-slate-400">
              <span>
                {attribute.type === "enum"
                  ? `enum(${enums.find((e) => e.id === attribute.enumId)?.name ?? "?"})`
                  : attribute.type}
                {!attribute.nullable && <span className="text-slate-500">*</span>}
              </span>
              {attribute.domainId && (
                <span
                  className="rounded bg-brand-50 px-1 text-[9px] font-medium text-brand-600"
                  title="Domain"
                >
                  {domains.find((d) => d.id === attribute.domainId)?.name ?? "?"}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
