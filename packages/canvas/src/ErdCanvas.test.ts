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
  it("maps entity ui position onto the node and passes the entity through as data", () => {
    expect(modelToNodes(model)).toEqual([
      {
        id: "customer",
        type: "entity",
        position: { x: 100, y: 200 },
        data: { entity: model.entities[0] },
      },
    ]);
  });
});

describe("modelToEdges", () => {
  it("maps relationship endpoints and a name+cardinality label onto the edge", () => {
    const edges = modelToEdges(model);
    expect(edges).toHaveLength(1);
    expect(edges[0]).toMatchObject({
      id: "r1",
      source: "customer",
      target: "order",
      label: "places (1 : N)",
    });
  });

  it("dashes non-identifying relationships and leaves identifying ones solid", () => {
    const [nonIdentifying] = modelToEdges(model);
    expect(nonIdentifying?.style?.strokeDasharray).toBe("6 4");

    const identifyingModel: Model = {
      ...model,
      relationships: [{ ...model.relationships[0]!, kind: "identifying" }],
    };
    const [identifying] = modelToEdges(identifyingModel);
    expect(identifying?.style?.strokeDasharray).toBeUndefined();
  });

  it("falls back to just the cardinality when the relationship has no name", () => {
    const unnamedModel: Model = {
      ...model,
      relationships: [{ ...model.relationships[0]!, name: undefined }],
    };
    expect(modelToEdges(unnamedModel)[0]?.label).toBe("1 : N");
  });
});
