import { useState } from "react";
import type { NodeProps } from "reactflow";

export interface MemoNodeData {
  text: string;
  color?: string;
  // Bound per-node by ErdCanvas (see modelToMemoNodes) rather than routed through the
  // generic onNodeClick/onNodeDragStop props — a memo's text edits happen inline on the
  // canvas itself, unlike Entities/Relationships which open a side Inspector.
  onTextChange: (text: string) => void;
  onDelete: () => void;
}

const DEFAULT_COLOR = "#fde68a"; // amber-200 — reads as a sticky note, distinct from
// EDGE_COLOR/SubjectAreaNode's slate/brand palette used for structural canvas elements.

// A freeform sticky note — edited inline via a textarea rather than through a side
// Inspector, since a memo has nothing to configure beyond its text and position.
export function MemoNode({ data }: NodeProps<MemoNodeData>) {
  const [text, setText] = useState(data.text);
  const color = data.color ?? DEFAULT_COLOR;

  return (
    <div
      className="flex h-full w-full flex-col rounded-md shadow-sm"
      style={{ backgroundColor: color }}
    >
      {/* No `nodrag` here — this bar (and the note's background) is what the user grabs
          to move the memo, matching every other node's default full-body drag area. */}
      <div className="flex cursor-move items-center justify-end px-1.5 py-1">
        {/* `nodrag` on the interactive controls only, so clicking/typing in them edits
            the memo instead of starting a node drag. */}
        <button
          className="nodrag text-xs leading-none text-black/40 hover:text-black/70"
          onClick={data.onDelete}
          aria-label="Delete memo"
        >
          ✕
        </button>
      </div>
      <textarea
        className="nodrag min-h-0 flex-1 resize-none bg-transparent px-2 pb-2 text-xs text-slate-800 outline-none placeholder:text-black/30"
        value={text}
        placeholder="Type a note…"
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          if (text !== data.text) data.onTextChange(text);
        }}
      />
    </div>
  );
}
