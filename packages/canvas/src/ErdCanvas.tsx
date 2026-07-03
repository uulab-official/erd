import { useCallback, useEffect, useMemo, useState } from "react";
import {
  applyNodeChanges,
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
} from "reactflow";
import type { Model, Relationship } from "@modelforge/schema-engine";
import { EntityNode, type EntityNodeData } from "./EntityNode.js";
import "reactflow/dist/style.css";

export interface ConnectEntitiesParams {
  sourceEntityId: string;
  targetEntityId: string;
}

export interface MoveEntityParams {
  entityId: string;
  x: number;
  y: number;
}

export interface ErdCanvasProps {
  model: Model;
  // Fired when the user drags a connection from one entity's Handle to another's — the
  // caller decides what Relationship (if any) that should create; the Canvas itself has
  // no opinion beyond "these two entities got connected."
  onConnectEntities?: (params: ConnectEntitiesParams) => void;
  // Fired with an Entity's id when its node is clicked, or null when the empty canvas
  // (the "pane") is clicked — the latter is how callers know to close an Inspector panel.
  onSelectEntity?: (entityId: string | null) => void;
  // Same contract for Relationship edges: the edge's id on click, null on pane click.
  // Edge ids ARE Relationship ids (see modelToEdges), so callers can look the model up
  // directly. A node click does NOT fire this with null — callers deciding "entity vs
  // relationship inspector" should treat the two selections as mutually exclusive
  // themselves (see apps/web's useSelectionStore).
  onSelectRelationship?: (relationshipId: string | null) => void;
  // Fired once when a node drag ends, with the entity's final canvas position — NOT on
  // every intermediate drag frame. Intermediate movement lives in this component's local
  // React Flow state (see the semi-controlled `nodes` below); the caller only needs to
  // persist the end position into the Model (e.g. as a MoveEntity Operation).
  onMoveEntity?: (params: MoveEntityParams) => void;
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
export function ErdCanvas({
  model,
  onConnectEntities,
  onSelectEntity,
  onSelectRelationship,
  onMoveEntity,
}: ErdCanvasProps) {
  // Nodes are semi-controlled: the Model is the source of truth (re-synced whenever its
  // entities change — including undo/redo, which snaps nodes back), but drags mutate
  // this local copy frame-by-frame so movement is smooth without writing an Operation
  // per mousemove. onNodeDragStop then reports the final position via onMoveEntity.
  const [nodes, setNodes] = useState<Node<EntityNodeData>[]>(() => modelToNodes(model));
  useEffect(() => {
    setNodes(modelToNodes(model));
  }, [model.entities]);
  const edges = useMemo(() => modelToEdges(model), [model.relationships]);

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) =>
      setNodes((current) => applyNodeChanges(changes, current) as Node<EntityNodeData>[]),
    [],
  );

  const handleNodeDragStop = useCallback(
    (_event: unknown, node: Node) =>
      onMoveEntity?.({ entityId: node.id, x: node.position.x, y: node.position.y }),
    [onMoveEntity],
  );

  const handleConnect = useCallback(
    (connection: Connection) => {
      // React Flow's Connection allows either endpoint to be null (a drag that didn't
      // land on a Handle) — nothing to report in that case.
      if (!onConnectEntities || !connection.source || !connection.target) return;
      onConnectEntities({
        sourceEntityId: connection.source,
        targetEntityId: connection.target,
      });
    },
    [onConnectEntities],
  );

  const handleNodeClick = useCallback(
    (_event: unknown, node: Node) => onSelectEntity?.(node.id),
    [onSelectEntity],
  );

  const handleEdgeClick = useCallback(
    (_event: unknown, edge: Edge) => onSelectRelationship?.(edge.id),
    [onSelectRelationship],
  );

  const handlePaneClick = useCallback(() => {
    onSelectEntity?.(null);
    onSelectRelationship?.(null);
  }, [onSelectEntity, onSelectRelationship]);

  return (
    <ReactFlowProvider>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={handleNodesChange}
        onNodeDragStop={handleNodeDragStop}
        onConnect={handleConnect}
        onNodeClick={handleNodeClick}
        onEdgeClick={handleEdgeClick}
        onPaneClick={handlePaneClick}
        fitView
      />
    </ReactFlowProvider>
  );
}
