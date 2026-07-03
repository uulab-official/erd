import { useMemo } from "react";
import { MarkerType, ReactFlow, ReactFlowProvider, type Edge, type Node } from "reactflow";
import type { Model, Relationship } from "@modelforge/schema-engine";
import { EntityNode, type EntityNodeData } from "./EntityNode.js";
import "reactflow/dist/style.css";

export interface ErdCanvasProps {
  model: Model;
}

const nodeTypes = { entity: EntityNode };

// Slate-400 — the same neutral used for structural borders throughout apps/web's design
// system (see packages/ui), so edges read as part of the same visual language as the
// panels around the canvas rather than React Flow's own default gray.
const EDGE_COLOR = "#94a3b8";

const CARDINALITY_LABEL: Record<Relationship["cardinality"], string> = {
  "one-to-one": "1 : 1",
  "one-to-many": "1 : N",
  "many-to-many": "N : N",
};

export function modelToNodes(model: Model): Node<EntityNodeData>[] {
  return model.entities.map((entity) => ({
    id: entity.id,
    type: "entity",
    position: { x: entity.ui.x, y: entity.ui.y },
    data: { entity },
  }));
}

export function modelToEdges(model: Model): Edge[] {
  return model.relationships.map((rel) => {
    const label = rel.name
      ? `${rel.name} (${CARDINALITY_LABEL[rel.cardinality]})`
      : CARDINALITY_LABEL[rel.cardinality];
    return {
      id: rel.id,
      source: rel.sourceEntityId,
      target: rel.targetEntityId,
      label,
      // Solid = identifying (child's PK includes the parent's), dashed = non-identifying —
      // the standard ERD convention for the two Relationship "kind"s.
      style: {
        stroke: EDGE_COLOR,
        strokeWidth: 1.5,
        strokeDasharray: rel.kind === "non-identifying" ? "6 4" : undefined,
      },
      labelStyle: { fill: "#475569", fontSize: 11, fontWeight: 500 },
      labelBgStyle: { fill: "#ffffff", fillOpacity: 0.9 },
      labelBgPadding: [4, 2] as [number, number],
      labelBgBorderRadius: 4,
      markerEnd: { type: MarkerType.ArrowClosed, color: EDGE_COLOR, width: 18, height: 18 },
    };
  });
}

// Renders one EntityNode per Entity at its stored ui position, with a styled edge per
// Relationship (see modelToEdges for what the styling communicates).
export function ErdCanvas({ model }: ErdCanvasProps) {
  const nodes = useMemo(() => modelToNodes(model), [model.entities]);
  const edges = useMemo(() => modelToEdges(model), [model.relationships]);

  return (
    <ReactFlowProvider>
      <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView />
    </ReactFlowProvider>
  );
}
