import { describe, expect, it } from "vitest";
import { createEntity } from "./entity.js";
import { createRelationship } from "./relationship.js";
import { deleteEntityCascade, undoTransaction } from "./transaction.js";
import { customerEntity, emptyModel, orderEntity } from "./test-fixtures.js";
import type { Relationship } from "@modelforge/schema-engine";

function modelWithRelationship() {
  let model = createEntity(emptyModel(), customerEntity(), "user-1").model;
  model = createEntity(model, orderEntity(), "user-1").model;
  const relationship: Relationship = {
    id: "r1",
    sourceEntityId: "customer",
    targetEntityId: "order",
    cardinality: "one-to-many",
    kind: "non-identifying",
    optionality: "mandatory",
    sourceAttributeIds: ["id"],
    targetAttributeIds: ["customer_id"],
  };
  return createRelationship(model, relationship, "user-1").model;
}

describe("deleteEntityCascade", () => {
  it("deletes the entity's relationships before the entity itself", () => {
    const before = modelWithRelationship();
    const { model, transaction } = deleteEntityCascade(before, "customer", "user-1");
    expect(model.entities.map((e) => e.id)).toEqual(["order"]);
    expect(model.relationships).toEqual([]);
    expect(transaction.operations).toHaveLength(2);
    expect(transaction.operations[0]?.type).toBe("DeleteRelationship");
    expect(transaction.operations[1]?.type).toBe("DeleteEntity");
  });

  it("undoTransaction restores the entity and its relationship atomically", () => {
    const before = modelWithRelationship();
    const { model, transaction } = deleteEntityCascade(before, "customer", "user-1");
    expect(undoTransaction(model, transaction)).toEqual(before);
  });
});
