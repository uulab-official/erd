import { useMemo } from "react";
import { ReactFlow, ReactFlowProvider, type Edge, type Node } from "reactflow";
import type { Model } from "@modelforge/schema-engine";
import "reactflow/dist/style.css";

export interface ErdCanvasProps {
  model: Model;
}

export function modelToNodes(model: Model): Node[] {
  return model.entities.map((entity) => ({
    id: entity.id,
    position: { x: entity.ui.x, y: entity.ui.y },
    data: { label: entity.logicalName },
  }));
}

export function modelToEdges(model: Model): Edge[] {
  return model.relationships.map((rel) => ({
    id: rel.id,
    source: rel.sourceEntityId,
    target: rel.targetEntityId,
    label: rel.name,
  }));
}

// Phase 1 placeholder: renders one React Flow node per Entity at its stored ui position,
// with a plain edge per Relationship. Custom node/edge types land with the real Canvas Engine.
export function ErdCanvas({ model }: ErdCanvasProps) {
  const nodes = useMemo(() => modelToNodes(model), [model.entities]);
  const edges = useMemo(() => modelToEdges(model), [model.relationships]);

  return (
    <ReactFlowProvider>
      <ReactFlow nodes={nodes} edges={edges} fitView />
    </ReactFlowProvider>
  );
}
