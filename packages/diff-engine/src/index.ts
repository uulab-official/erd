// diff(modelA, modelB) -> structural differences, excluding ui.* fields. See /docs/operations.md.
import type { Model } from "@modelforge/schema-engine";

export interface EntityDiff {
  added: string[];
  removed: string[];
  changed: string[];
}

// Phase 1: entity-level added/removed/changed by physicalName, ignoring `ui`.
// Attribute/relationship-level diffing lands with the Deploy Engine migration planner.
export function diffModels(a: Model, b: Model): EntityDiff {
  const namesA = new Map(a.entities.map((e) => [e.physicalName, e]));
  const namesB = new Map(b.entities.map((e) => [e.physicalName, e]));

  const added = [...namesB.keys()].filter((name) => !namesA.has(name));
  const removed = [...namesA.keys()].filter((name) => !namesB.has(name));
  const changed = [...namesA.keys()].filter((name) => {
    const entityA = namesA.get(name);
    const entityB = namesB.get(name);
    if (!entityA || !entityB) return false;
    return (
      JSON.stringify({ ...entityA, ui: undefined }) !==
      JSON.stringify({ ...entityB, ui: undefined })
    );
  });

  return { added, removed, changed };
}
