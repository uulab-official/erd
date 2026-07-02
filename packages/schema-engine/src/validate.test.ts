import { describe, expect, it } from "vitest";
import { validateModel } from "./validate.js";
import type { Model } from "./types.js";

function emptyModel(): Model {
  return {
    id: "model-1",
    name: "Test",
    adapter: "postgresql",
    entities: [],
    relationships: [],
    views: [],
    sequences: [],
    enums: [],
  };
}

describe("validateModel", () => {
  it("flags an entity with no primary key", () => {
    const model = emptyModel();
    model.entities.push({
      id: "e1",
      logicalName: "Customer",
      physicalName: "customer",
      tags: [],
      attributes: [
        {
          id: "a1",
          name: "name",
          logicalName: "Name",
          type: "string",
          nullable: false,
          isPrimaryKey: false,
          isForeignKey: false,
          isUnique: false,
        },
      ],
      indexes: [],
      ui: { x: 0, y: 0 },
    });

    const issues = validateModel(model);
    expect(issues.some((i) => i.code === "no-primary-key")).toBe(true);
    expect(issues.some((i) => i.code === "orphan-entity")).toBe(true);
  });

  it("returns no issues for a valid connected model", () => {
    const model = emptyModel();
    model.entities.push(
      {
        id: "e1",
        logicalName: "Customer",
        physicalName: "customer",
        tags: [],
        attributes: [
          {
            id: "a1",
            name: "id",
            logicalName: "ID",
            type: "uuid",
            nullable: false,
            isPrimaryKey: true,
            isForeignKey: false,
            isUnique: true,
          },
        ],
        indexes: [],
        ui: { x: 0, y: 0 },
      },
      {
        id: "e2",
        logicalName: "Order",
        physicalName: "order",
        tags: [],
        attributes: [
          {
            id: "a2",
            name: "id",
            logicalName: "ID",
            type: "uuid",
            nullable: false,
            isPrimaryKey: true,
            isForeignKey: false,
            isUnique: true,
          },
          {
            id: "a3",
            name: "customer_id",
            logicalName: "Customer ID",
            type: "uuid",
            nullable: false,
            isPrimaryKey: false,
            isForeignKey: true,
            isUnique: false,
          },
        ],
        indexes: [],
        ui: { x: 0, y: 0 },
      },
    );
    model.relationships.push({
      id: "r1",
      sourceEntityId: "e1",
      targetEntityId: "e2",
      cardinality: "one-to-many",
      kind: "non-identifying",
      optionality: "mandatory",
      sourceAttributeIds: ["a1"],
      targetAttributeIds: ["a3"],
    });

    expect(validateModel(model)).toEqual([]);
  });
});
