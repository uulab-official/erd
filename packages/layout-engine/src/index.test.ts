import { describe, expect, it } from "vitest";
import { gridLayoutEngine } from "./index.js";
import type { Model } from "@modelforge/schema-engine";

function modelWithEntities(count: number): Model {
  return {
    id: "m1",
    name: "Test",
    adapter: "postgresql",
    relationships: [],
    views: [],
    sequences: [],
    enums: [],
    entities: Array.from({ length: count }, (_, i) => ({
      id: `e${i}`,
      logicalName: `Entity${i}`,
      physicalName: `entity_${i}`,
      tags: [],
      attributes: [],
      indexes: [],
      ui: { x: 0, y: 0 },
    })),
  };
}

describe("gridLayoutEngine", () => {
  it("places every entity at a unique position", async () => {
    const positions = await gridLayoutEngine.layout(modelWithEntities(4));
    expect(Object.keys(positions)).toHaveLength(4);
  });
});
