import { describe, expect, it } from "vitest";
import type { Entity, Model, Relationship } from "@modelforge/schema-engine";
import { layeredLayoutEngine } from "./layered.js";

function entity(id: string): Entity {
  return {
    id,
    logicalName: id,
    physicalName: id,
    tags: [],
    attributes: [],
    indexes: [],
    ui: { x: 0, y: 0 },
  };
}

function relationship(id: string, sourceEntityId: string, targetEntityId: string): Relationship {
  return {
    id,
    sourceEntityId,
    targetEntityId,
    cardinality: "one-to-many",
    kind: "non-identifying",
    optionality: "mandatory",
    sourceAttributeIds: [],
    targetAttributeIds: [],
  };
}

function model(entities: Entity[], relationships: Relationship[]): Model {
  return {
    id: "m1",
    name: "Test",
    adapter: "postgresql",
    entities,
    relationships,
    views: [],
    sequences: [],
    enums: [],
  };
}

describe("layeredLayoutEngine", () => {
  it("places relationship chains left-to-right by depth", async () => {
    const positions = await layeredLayoutEngine.layout(
      model(
        [entity("a"), entity("b"), entity("c")],
        [relationship("r1", "a", "b"), relationship("r2", "b", "c")],
      ),
    );
    expect(positions.a!.x).toBeLessThan(positions.b!.x);
    expect(positions.b!.x).toBeLessThan(positions.c!.x);
  });

  it("uses the longest path when an entity is referenced from multiple depths", async () => {
    // a -> b -> c and a -> c: c must sit right of b, not share b's column.
    const positions = await layeredLayoutEngine.layout(
      model(
        [entity("a"), entity("b"), entity("c")],
        [relationship("r1", "a", "b"), relationship("r2", "b", "c"), relationship("r3", "a", "c")],
      ),
    );
    expect(positions.b!.x).toBeGreaterThan(positions.a!.x);
    expect(positions.c!.x).toBeGreaterThan(positions.b!.x);
  });

  it("terminates on relationship cycles", async () => {
    const positions = await layeredLayoutEngine.layout(
      model(
        [entity("a"), entity("b")],
        [relationship("r1", "a", "b"), relationship("r2", "b", "a")],
      ),
    );
    expect(Object.keys(positions)).toHaveLength(2);
    expect(positions.a!.x).not.toBe(positions.b!.x);
  });

  it("gives every entity a unique position, isolated ones in a trailing column", async () => {
    const positions = await layeredLayoutEngine.layout(
      model(
        [entity("a"), entity("b"), entity("lonely"), entity("hermit")],
        [relationship("r1", "a", "b")],
      ),
    );
    const seen = new Set(Object.values(positions).map((p) => `${p.x},${p.y}`));
    expect(seen.size).toBe(4);
    expect(positions.lonely!.x).toBeGreaterThan(positions.b!.x);
    expect(positions.lonely!.x).toBe(positions.hermit!.x);
  });

  it("handles an empty model", async () => {
    const positions = await layeredLayoutEngine.layout(model([], []));
    expect(positions).toEqual({});
  });
});
