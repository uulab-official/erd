import { describe, expect, it } from "vitest";
import {
  changeRelationshipCardinality,
  changeRelationshipKind,
  createRelationship,
  deleteRelationship,
  setRelationshipMeta,
} from "./relationship.js";
import { createEntity } from "./entity.js";
import { applyInverse } from "./apply.js";
import { customerEntity, emptyModel, orderEntity } from "./test-fixtures.js";
import type { Relationship } from "@modelforge/schema-engine";

function baseModel() {
  let model = createEntity(emptyModel(), customerEntity(), "user-1").model;
  model = createEntity(model, orderEntity(), "user-1").model;
  return model;
}

function placesRelationship(): Relationship {
  return {
    id: "r1",
    name: "places",
    sourceEntityId: "customer",
    targetEntityId: "order",
    cardinality: "one-to-many",
    kind: "non-identifying",
    optionality: "mandatory",
    sourceAttributeIds: ["id"],
    targetAttributeIds: ["customer_id"],
  };
}

describe("createRelationship / deleteRelationship", () => {
  it("creates a relationship and its inverse removes it", () => {
    const before = baseModel();
    const { model, operation } = createRelationship(before, placesRelationship(), "user-1");
    expect(model.relationships).toHaveLength(1);
    expect(applyInverse(model, operation)).toEqual(before);
  });

  it("throws when a source attribute does not belong to the source entity", () => {
    const before = baseModel();
    const relationship = { ...placesRelationship(), sourceAttributeIds: ["customer_id"] };
    expect(() => createRelationship(before, relationship, "user-1")).toThrow();
  });

  it("throws when a target attribute does not belong to the target entity", () => {
    const before = baseModel();
    const relationship = { ...placesRelationship(), targetAttributeIds: ["not-on-order"] };
    expect(() => createRelationship(before, relationship, "user-1")).toThrow();
  });

  it("rejects a relationship referencing an unknown entity", () => {
    const before = baseModel();
    expect(() =>
      createRelationship(before, { ...placesRelationship(), targetEntityId: "missing" }, "user-1"),
    ).toThrow();
  });

  it("deleteRelationship's inverse restores it", () => {
    const created = createRelationship(baseModel(), placesRelationship(), "user-1");
    const { model, operation } = deleteRelationship(
      created.model,
      { relationshipId: "r1" },
      "user-1",
    );
    expect(model.relationships).toHaveLength(0);
    expect(applyInverse(model, operation)).toEqual(created.model);
  });
});

describe("changeRelationshipCardinality / changeRelationshipKind", () => {
  it("changes cardinality and its inverse restores it", () => {
    const created = createRelationship(baseModel(), placesRelationship(), "user-1");
    const { model, operation } = changeRelationshipCardinality(
      created.model,
      { relationshipId: "r1", cardinality: "one-to-one" },
      "user-1",
    );
    expect(model.relationships[0]?.cardinality).toBe("one-to-one");
    expect(applyInverse(model, operation)).toEqual(created.model);
  });

  it("changes kind and its inverse restores it", () => {
    const created = createRelationship(baseModel(), placesRelationship(), "user-1");
    const { model, operation } = changeRelationshipKind(
      created.model,
      { relationshipId: "r1", kind: "identifying" },
      "user-1",
    );
    expect(model.relationships[0]?.kind).toBe("identifying");
    expect(applyInverse(model, operation)).toEqual(created.model);
  });
});

describe("setRelationshipMeta", () => {
  it("updates name/optionality and its inverse restores them", () => {
    const created = createRelationship(baseModel(), placesRelationship(), "user-1");
    const { model, operation } = setRelationshipMeta(
      created.model,
      { relationshipId: "r1", meta: { name: "submits", optionality: "optional" } },
      "user-1",
    );
    expect(model.relationships[0]?.name).toBe("submits");
    expect(model.relationships[0]?.optionality).toBe("optional");
    expect(applyInverse(model, operation)).toEqual(created.model);
  });

  it("only touches the keys in the payload", () => {
    const created = createRelationship(baseModel(), placesRelationship(), "user-1");
    const { model } = setRelationshipMeta(
      created.model,
      { relationshipId: "r1", meta: { onDelete: "cascade" } },
      "user-1",
    );
    expect(model.relationships[0]?.onDelete).toBe("cascade");
    expect(model.relationships[0]?.name).toBe("places");
  });

  it("its inverse restores a previously-unset key back to undefined", () => {
    const created = createRelationship(baseModel(), placesRelationship(), "user-1");
    const { model, operation } = setRelationshipMeta(
      created.model,
      { relationshipId: "r1", meta: { onDelete: "cascade" } },
      "user-1",
    );
    expect(applyInverse(model, operation)).toEqual(created.model);
  });

  it("throws for an unknown relationship", () => {
    expect(() =>
      setRelationshipMeta(baseModel(), { relationshipId: "missing", meta: {} }, "user-1"),
    ).toThrow();
  });
});
