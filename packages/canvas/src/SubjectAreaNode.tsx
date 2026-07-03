import type { NodeProps } from "reactflow";

export interface SubjectAreaNodeData {
  name: string;
  color?: string;
}

const DEFAULT_COLOR = "#94a3b8"; // slate-400, matches EDGE_COLOR in ErdCanvas

// A background group box for a Subject Area — not draggable/selectable/connectable
// (see ErdCanvas's node construction), it exists purely to visually fence in its
// member Entities. Pointer-events are disabled so clicks pass through to whatever
// Entity/edge is drawn on top of it.
export function SubjectAreaNode({ data }: NodeProps<SubjectAreaNodeData>) {
  const color = data.color ?? DEFAULT_COLOR;
  return (
    <div
      className="pointer-events-none relative h-full w-full rounded-xl border-2 border-dashed"
      style={{ borderColor: color }}
    >
      {/* Separate tint layer (rather than a shorthand hex-alpha background on the
          bordered div) so this works for any CSS color format the user picks, not just
          6-digit hex. */}
      <div
        className="absolute inset-0 rounded-[10px]"
        style={{ backgroundColor: color, opacity: 0.08 }}
      />
      <div
        className="relative inline-block rounded-br-lg rounded-tl-[10px] px-2 py-1 text-xs font-semibold"
        style={{ backgroundColor: color, color: "#fff" }}
      >
        {data.name}
      </div>
    </div>
  );
}
