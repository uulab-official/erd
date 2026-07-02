import { describe, expect, it } from "vitest";
import { createEntity, deleteEntity, moveEntity, renameEntity, setEntityMeta } from "./entity.js";
import { applyInverse } from "./apply.js";
import { customerEntity, emptyModel } from "./test-fixtures.js";

describe("createEntity", () => {
  it("adds the entity and produces a DeleteEntity inverse", () => {
    const { model, operation } = createEntity(emptyModel(), customerEntity(), "user-1");
    expect(model.entities).toHaveLength(1);
    expect(operation.type).toBe("CreateEntity");
    expect(operation.inverse).toEqual({ type: "DeleteEntity", payload: { entityId: "customer" } });
  });

  it("rejects a duplicate entity id", () => {
    const { model } = createEntity(emptyModel(), customerEntity(), "user-1");
    expect(() => createEntity(model, customerEntity(), "user-1")).toThrow();
  });

  it("round-trips through its own inverse", () => {
    const before = emptyModel();
    const { model, operation } = createEntity(before, customerEntity(), "user-1");
    expect(applyInverse(model, operation)).toEqual(before);
  });
});

describe("deleteEntity", () => {
  it("removes the entity and produces a CreateEntity inverse that restores it", () => {
    const created = createEntity(emptyModel(), customerEntity(), "user-1");
    const { model, operation } = deleteEntity(created.model, { entityId: "customer" }, "user-1");
    expect(model.entities).toHaveLength(0);
    expect(applyInverse(model, operation)).toEqual(created.model);
  });

  it("refuses to delete an entity still referenced by a relationship", () => {
    let model = createEntity(emptyModel(), customerEntity(), "user-1").model;
    model = {
      ...model,
      relationships: [
        {
          id: "r1",
          sourceEntityId: "customer",
          targetEntityId: "customer",
          cardinality: "one-to-many",
          kind: "non-identifying",
          optionality: "optional",
          sourceAttributeIds: [],
          targetAttributeIds: [],
        },
      ],
    };
    expect(() => deleteEntity(model, { entityId: "customer" }, "user-1")).toThrow();
  });
});

describe("renameEntity", () => {
  it("renames and its inverse restores the original names", () => {
    const created = createEntity(emptyModel(), customerEntity(), "user-1");
    const { model, operation } = renameEntity(
      created.model,
      { entityId: "customer", logicalName: "Client" },
      "user-1",
    );
    expect(model.entities[0]?.logicalName).toBe("Client");
    expect(applyInverse(model, operation)).toEqual(created.model);
  });
});

describe("moveEntity", () => {
  it("moves and its inverse restores the original position", () => {
    const created = createEntity(emptyModel(), customerEntity(), "user-1");
    const { model, operation } = moveEntity(
      created.model,
      { entityId: "customer", x: 500, y: 100 },
      "user-1",
    );
    expect(model.entities[0]?.ui).toEqual({ x: 500, y: 100 });
    expect(applyInverse(model, operation)).toEqual(created.model);
  });
});

describe("setEntityMeta", () => {
  it("updates only the given fields and its inverse restores them", () => {
    const created = createEntity(emptyModel(), customerEntity(), "user-1");
    const { model, operation } = setEntityMeta(
      created.model,
      { entityId: "customer", meta: { color: "#ff0000", description: "VIP customers" } },
      "user-1",
    );
    expect(model.entities[0]?.color).toBe("#ff0000");
    expect(applyInverse(model, operation)).toEqual(created.model);
  });
});
