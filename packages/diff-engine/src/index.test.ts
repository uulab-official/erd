import { describe, expect, it } from "vitest";
import { diffModels } from "./index.js";
import type { Model, Entity } from "@modelforge/schema-engine";

function entity(physicalName: string, x = 0): Entity {
  return {
    id: physicalName,
    logicalName: physicalName,
    physicalName,
    tags: [],
    attributes: [],
    indexes: [],
    ui: { x, y: 0 },
  };
}

function model(entities: Entity[]): Model {
  return {
    id: "m1",
    name: "Test",
    adapter: "postgresql",
    relationships: [],
    views: [],
    sequences: [],
    enums: [],
    entities,
  };
}

describe("diffModels", () => {
  it("detects added and removed entities", () => {
    const a = model([entity("customer")]);
    const b = model([entity("customer"), entity("order")]);
    expect(diffModels(a, b)).toEqual({ added: ["order"], removed: [], changed: [] });
  });

  it("ignores ui-only position changes", () => {
    const a = model([entity("customer", 0)]);
    const b = model([entity("customer", 500)]);
    expect(diffModels(a, b).changed).toEqual([]);
  });
});
