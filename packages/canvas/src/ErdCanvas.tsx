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
import type { Entity, Model, Relationship } from "@modelforge/schema-engine";
import { EntityNode, type EntityNodeData } from "./EntityNode.js";
import { MemoNode, type MemoNodeData } from "./MemoNode.js";
import { SubjectAreaNode, type SubjectAreaNodeData } from "./SubjectAreaNode.js";
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

export interface MoveMemoParams {
  memoId: string;
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
  // Same drag-end contract as onMoveEntity, for freeform Memo notes.
  onMoveMemo?: (params: MoveMemoParams) => void;
  onUpdateMemoText?: (params: { memoId: string; text: string }) => void;
  onDeleteMemo?: (memoId: string) => void;
}

const nodeTypes = { entity: EntityNode, subjectArea: SubjectAreaNode, memo: MemoNode };

type CanvasNode = Node<EntityNodeData> | Node<SubjectAreaNodeData> | Node<MemoNodeData>;

const MEMO_WIDTH = 180;
const MEMO_HEIGHT = 120;

// Rough EntityNode footprint in pixels — must track EntityNode.tsx's `w-56` (224px)
// header/row classes closely enough for a background group box, not pixel-perfect.
// Getting this slightly wrong just means the box has a bit of extra/missing margin.
const ENTITY_WIDTH = 224;
const ENTITY_HEADER_HEIGHT = 52;
const ENTITY_ROW_HEIGHT = 28;
const SUBJECT_AREA_PADDING = 32;

function entityFootprint(entity: Entity): { width: number; height: number } {
  return {
    width: ENTITY_WIDTH,
    height: ENTITY_HEADER_HEIGHT + Math.max(1, entity.attributes.length) * ENTITY_ROW_HEIGHT,
  };
}

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
    data: { entity, enums: model.enums, domains: model.domains ?? [] },
  }));
}

// One background box per non-empty Subject Area, sized to bound every member Entity's
// current position. Not draggable/selectable/connectable — it's a visual fence, not an
// interactive element — and rendered with zIndex -1 so it always sits behind Entities
// and edges regardless of array order.
export function modelToSubjectAreaNodes(model: Model): Node<SubjectAreaNodeData>[] {
  const entitiesById = new Map(model.entities.map((e) => [e.id, e]));
  return (model.subjectAreas ?? []).flatMap((subjectArea) => {
    const members = subjectArea.entityIds
      .map((id) => entitiesById.get(id))
      .filter((e): e is Entity => e !== undefined);
    if (members.length === 0) return [];

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const entity of members) {
      const { width, height } = entityFootprint(entity);
      minX = Math.min(minX, entity.ui.x);
      minY = Math.min(minY, entity.ui.y);
      maxX = Math.max(maxX, entity.ui.x + width);
      maxY = Math.max(maxY, entity.ui.y + height);
    }

    return [
      {
        id: `subject-area:${subjectArea.id}`,
        type: "subjectArea",
        position: { x: minX - SUBJECT_AREA_PADDING, y: minY - SUBJECT_AREA_PADDING },
        style: {
          width: maxX - minX + SUBJECT_AREA_PADDING * 2,
          height: maxY - minY + SUBJECT_AREA_PADDING * 2,
        },
        data: { name: subjectArea.name, color: subjectArea.color },
        draggable: false,
        selectable: false,
        connectable: false,
        zIndex: -1,
      },
    ];
  });
}

// One node per Memo, with per-node onTextChange/onDelete callbacks bound to that
// Memo's id — MemoNode edits text inline rather than through a side Inspector, so it
// needs a direct way to report changes rather than going through the generic
// onNodeClick/onNodeDragStop props every other node type uses.
export function modelToMemoNodes(
  model: Model,
  callbacks: {
    onUpdateMemoText?: (params: { memoId: string; text: string }) => void;
    onDeleteMemo?: (memoId: string) => void;
  },
): Node<MemoNodeData>[] {
  return (model.memos ?? []).map((memo) => ({
    id: `memo:${memo.id}`,
    type: "memo",
    position: { x: memo.x, y: memo.y },
    style: { width: MEMO_WIDTH, height: MEMO_HEIGHT },
    data: {
      text: memo.text,
      color: memo.color,
      onTextChange: (text: string) => callbacks.onUpdateMemoText?.({ memoId: memo.id, text }),
      onDelete: () => callbacks.onDeleteMemo?.(memo.id),
    },
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
  onMoveMemo,
  onUpdateMemoText,
  onDeleteMemo,
}: ErdCanvasProps) {
  // Nodes are semi-controlled: the Model is the source of truth (re-synced whenever its
  // entities, subject areas, or memos change — including undo/redo, which snaps nodes
  // back), but drags mutate this local copy frame-by-frame so movement is smooth
  // without writing an Operation per mousemove. onNodeDragStop then reports the final
  // position via onMoveEntity/onMoveMemo. Subject Area boxes are recomputed in the same
  // pass since they're sized from entity positions.
  const buildNodes = useCallback(
    (m: Model): CanvasNode[] => [
      ...modelToSubjectAreaNodes(m),
      ...modelToNodes(m),
      ...modelToMemoNodes(m, { onUpdateMemoText, onDeleteMemo }),
    ],
    [onUpdateMemoText, onDeleteMemo],
  );
  const [nodes, setNodes] = useState<CanvasNode[]>(() => buildNodes(model));
  useEffect(() => {
    setNodes(buildNodes(model));
  }, [model.entities, model.subjectAreas, model.memos, buildNodes]);
  const edges = useMemo(() => modelToEdges(model), [model.relationships]);

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) =>
      setNodes(
        (current) =>
          applyNodeChanges<EntityNodeData | SubjectAreaNodeData>(
            changes,
            current as Node<EntityNodeData | SubjectAreaNodeData>[],
          ) as CanvasNode[],
      ),
    [],
  );

  const handleNodeDragStop = useCallback(
    (_event: unknown, node: Node) => {
      if (node.type === "entity") {
        onMoveEntity?.({ entityId: node.id, x: node.position.x, y: node.position.y });
      } else if (node.type === "memo") {
        onMoveMemo?.({
          memoId: node.id.slice("memo:".length),
          x: node.position.x,
          y: node.position.y,
        });
      }
    },
    [onMoveEntity, onMoveMemo],
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
    (_event: unknown, node: Node) => {
      // Subject Area boxes sit behind Entities but are still real nodes, so a click on
      // their exposed background (not covered by any Entity) reaches here rather than
      // onPaneClick — treat it the same as a pane click so it closes any open Inspector.
      if (node.type !== "entity") {
        onSelectEntity?.(null);
        onSelectRelationship?.(null);
        return;
      }
      onSelectEntity?.(node.id);
    },
    [onSelectEntity, onSelectRelationship],
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
