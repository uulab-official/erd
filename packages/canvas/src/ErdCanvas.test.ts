import { describe, expect, it } from "vitest";
import { modelToNodes, modelToEdges } from "./ErdCanvas.js";
import type { Model } from "@modelforge/schema-engine";

const model: Model = {
  id: "m1",
  name: "Shop",
  adapter: "postgresql",
  relationships: [
    {
      id: "r1",
      name: "places",
      sourceEntityId: "customer",
      targetEntityId: "order",
      cardinality: "one-to-many",
      kind: "non-identifying",
      optionality: "mandatory",
      sourceAttributeIds: [],
      targetAttributeIds: [],
    },
  ],
  views: [],
  sequences: [],
  enums: [],
  entities: [
    {
      id: "customer",
      logicalName: "Customer",
      physicalName: "customer",
      tags: [],
      attributes: [],
      indexes: [],
      ui: { x: 100, y: 200 },
    },
  ],
};

describe("modelToNodes", () => {
  it("maps entity ui position onto the node", () => {
    expect(modelToNodes(model)).toEqual([
      { id: "customer", position: { x: 100, y: 200 }, data: { label: "Customer" } },
    ]);
  });
});

describe("modelToEdges", () => {
  it("maps relationship endpoints onto the edge", () => {
    expect(modelToEdges(model)).toEqual([
      { id: "r1", source: "customer", target: "order", label: "places" },
    ]);
  });
});
