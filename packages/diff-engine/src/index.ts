// diff(modelA, modelB) -> structural differences, excluding ui.* fields. See /docs/operations.md.
import type { Model } from "@modelforge/schema-engine";

export interface KeyedDiff {
  added: string[];
  removed: string[];
  changed: string[];
}

export interface EntityDiff extends KeyedDiff {
  // A change to an EnumType's values (with no attribute.enumId change) is otherwise
  // invisible here — it doesn't touch any Entity, so the entity-level added/removed/
  // changed above would report "no changes" even though a real Enum edit happened and
  // Deploy Plan (which independently resolves enumId via toNativeSchema) would show a
  // step for it. Same shape as the entity diff, keyed by EnumType.id.
  enums: KeyedDiff;
}

function diffByKey<T>(itemsA: T[], itemsB: T[], keyOf: (item: T) => string): KeyedDiff {
  const byKeyA = new Map(itemsA.map((item) => [keyOf(item), item]));
  const byKeyB = new Map(itemsB.map((item) => [keyOf(item), item]));

  const added = [...byKeyB.keys()].filter((key) => !byKeyA.has(key));
  const removed = [...byKeyA.keys()].filter((key) => !byKeyB.has(key));
  const changed = [...byKeyA.keys()].filter((key) => {
    const itemA = byKeyA.get(key);
    const itemB = byKeyB.get(key);
    if (!itemA || !itemB) return false;
    return JSON.stringify(itemA) !== JSON.stringify(itemB);
  });

  return { added, removed, changed };
}

// Phase 1: entity-level added/removed/changed by physicalName, ignoring `ui`, plus a
// top-level Enum diff (Enums have no `ui` to strip). Attribute/relationship-level
// diffing lands with the Deploy Engine migration planner.
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

  return { added, removed, changed, enums: diffByKey(a.enums, b.enums, (e) => e.id) };
}
