import { describe, expect, it } from "vitest";
import { applyInverse } from "./apply.js";
import { createEntity } from "./entity.js";
import { createIndex, deleteIndex } from "./indexes.js";
import { customerEntity, emptyModel } from "./test-fixtures.js";

function baseModel() {
  return createEntity(emptyModel(), customerEntity(), "user-1").model;
}

describe("createIndex / deleteIndex", () => {
  it("creates an index and its inverse removes it", () => {
    const before = baseModel();
    const index = { id: "idx_id", name: "idx_customer_id", attributeIds: ["id"], unique: true };
    const { model, operation } = createIndex(before, { entityId: "customer", index }, "user-1");
    expect(model.entities[0]?.indexes).toEqual([index]);
    expect(applyInverse(model, operation)).toEqual(before);
  });

  it("throws when creating a duplicate index id", () => {
    const before = baseModel();
    const index = { id: "idx_id", name: "idx_customer_id", attributeIds: ["id"], unique: true };
    const { model } = createIndex(before, { entityId: "customer", index }, "user-1");
    expect(() => createIndex(model, { entityId: "customer", index }, "user-1")).toThrow();
  });

  it("throws when the entity does not exist", () => {
    const before = baseModel();
    const index = { id: "idx_id", name: "idx_customer_id", attributeIds: ["id"], unique: true };
    expect(() => createIndex(before, { entityId: "missing", index }, "user-1")).toThrow();
  });

  it("deleteIndex's inverse restores the index at its original position", () => {
    const before = baseModel();
    const index = { id: "idx_id", name: "idx_customer_id", attributeIds: ["id"], unique: true };
    const withIndex = createIndex(before, { entityId: "customer", index }, "user-1").model;
    const { model, operation } = deleteIndex(
      withIndex,
      { entityId: "customer", indexId: "idx_id" },
      "user-1",
    );
    expect(model.entities[0]?.indexes).toHaveLength(0);
    expect(applyInverse(model, operation)).toEqual(withIndex);
  });

  it("throws when deleting an unknown index", () => {
    const before = baseModel();
    expect(() =>
      deleteIndex(before, { entityId: "customer", indexId: "missing" }, "user-1"),
    ).toThrow();
  });
});
