// Dependency-free layered ("Sugiyama-lite") layout for ERDs: parents left, children
// right, siblings vertically grouped near the entities they reference. Deliberately
// simpler than ELK/Dagre — no dummy nodes or crossing minimization sweeps — because ERD
// graphs are small (tens of entities) and readability matters more than optimality.
import type { Model } from "@modelforge/schema-engine";
import type { LayoutEngine } from "@modelforge/sdk";

const COLUMN_SPACING = 360;
const ROW_SPACING = 220;

interface Graph {
  // relationship source -> targets ("parent" entity -> entities holding its FK)
  out: Map<string, string[]>;
  in: Map<string, string[]>;
}

function buildGraph(model: Model): Graph {
  const out = new Map<string, string[]>();
  const inn = new Map<string, string[]>();
  for (const entity of model.entities) {
    out.set(entity.id, []);
    inn.set(entity.id, []);
  }
  for (const rel of model.relationships) {
    // Self-references don't affect layering; a Model may also briefly hold edges to
    // entities that no longer exist mid-transaction — skip anything unresolvable.
    if (rel.sourceEntityId === rel.targetEntityId) continue;
    if (!out.has(rel.sourceEntityId) || !out.has(rel.targetEntityId)) continue;
    out.get(rel.sourceEntityId)!.push(rel.targetEntityId);
    inn.get(rel.targetEntityId)!.push(rel.sourceEntityId);
  }
  return { out, in: inn };
}

// Longest-path layering via DFS. `visiting` breaks relationship cycles (legal in ERDs,
// e.g. employee.manager_id -> employee via an intermediate table): an edge that closes
// a cycle simply doesn't push its target further right.
function assignLayers(model: Model, graph: Graph): Map<string, number> {
  const layers = new Map<string, number>();
  const visiting = new Set<string>();

  function depth(id: string): number {
    const known = layers.get(id);
    if (known !== undefined) return known;
    if (visiting.has(id)) return 0;
    visiting.add(id);
    const parents = graph.in.get(id) ?? [];
    let layer = 0;
    for (const parent of parents) {
      if (visiting.has(parent)) continue;
      layer = Math.max(layer, depth(parent) + 1);
    }
    visiting.delete(id);
    layers.set(id, layer);
    return layer;
  }

  for (const entity of model.entities) depth(entity.id);
  return layers;
}

export const layeredLayoutEngine: LayoutEngine = {
  id: "layout.layered",
  label: "Auto (layered)",
  algorithm: "layer",
  async layout(model: Model) {
    const graph = buildGraph(model);
    const layers = assignLayers(model, graph);

    const connected = model.entities.filter(
      (e) => (graph.out.get(e.id)?.length ?? 0) > 0 || (graph.in.get(e.id)?.length ?? 0) > 0,
    );
    const connectedIds = new Set(connected.map((e) => e.id));
    const isolated = model.entities.filter((e) => !connectedIds.has(e.id));

    // Group by layer, then order each layer by the mean row of its parents (one
    // barycenter pass) so children line up near what they reference.
    const byLayer = new Map<number, string[]>();
    for (const entity of connected) {
      const layer = layers.get(entity.id) ?? 0;
      byLayer.set(layer, [...(byLayer.get(layer) ?? []), entity.id]);
    }

    const positions: Record<string, { x: number; y: number }> = {};
    const rowOf = new Map<string, number>();
    const layerNumbers = [...byLayer.keys()].sort((a, b) => a - b);

    for (const layerNumber of layerNumbers) {
      const ids = byLayer.get(layerNumber)!;
      const keyed = ids.map((id) => {
        const parents = (graph.in.get(id) ?? []).filter((p) => rowOf.has(p));
        const barycenter =
          parents.length > 0
            ? parents.reduce((sum, p) => sum + rowOf.get(p)!, 0) / parents.length
            : Number.MAX_SAFE_INTEGER; // parentless entries sink below anchored ones
        return { id, barycenter };
      });
      keyed.sort((a, b) => a.barycenter - b.barycenter);
      keyed.forEach((entry, row) => {
        rowOf.set(entry.id, row);
        positions[entry.id] = { x: layerNumber * COLUMN_SPACING, y: row * ROW_SPACING };
      });
    }

    // Isolated entities form their own trailing column so they never overlap the graph.
    // Layer numbers are contiguous from 0 (a layer k>0 only exists because some entity
    // has a parent at k-1), so the first free column is simply layerNumbers.length.
    const isolatedX = layerNumbers.length * COLUMN_SPACING;
    isolated.forEach((entity, row) => {
      positions[entity.id] = { x: isolatedX, y: row * ROW_SPACING };
    });

    return positions;
  },
};
