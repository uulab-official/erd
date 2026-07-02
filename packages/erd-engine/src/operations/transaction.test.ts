import { describe, expect, it } from "vitest";
import { assignDomain } from "./attribute.js";
import { createEntity } from "./entity.js";
import { createDomain } from "./governance.js";
import { createRelationship } from "./relationship.js";
import {
  deleteDomainCascade,
  deleteEntityCascade,
  undoTransaction,
  updateDomainCascade,
} from "./transaction.js";
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

const EMAIL_DOMAIN = { id: "d1", name: "Email", type: "string" as const, length: 320 };

function modelWithDomainAssignedToId() {
  const withEntity = createEntity(emptyModel(), customerEntity(), "user-1").model;
  const withDomain = createDomain(withEntity, { domain: EMAIL_DOMAIN }, "user-1").model;
  return assignDomain(
    withDomain,
    { entityId: "customer", attributeId: "id", domainId: "d1" },
    "user-1",
  ).model;
}

describe("updateDomainCascade", () => {
  it("re-syncs every assigned attribute's type/length/scale to the domain's new values", () => {
    const before = modelWithDomainAssignedToId();
    const { model, transaction } = updateDomainCascade(before, "d1", { length: 255 }, "user-1");
    expect(model.domains?.[0]?.length).toBe(255);
    expect(model.entities[0]?.attributes[0]?.length).toBe(255);
    expect(transaction.operations.map((o) => o.type)).toEqual(["UpdateDomain", "AssignDomain"]);
  });

  it("undoTransaction restores the domain and the attribute atomically", () => {
    const before = modelWithDomainAssignedToId();
    const { model, transaction } = updateDomainCascade(before, "d1", { length: 255 }, "user-1");
    expect(undoTransaction(model, transaction)).toEqual(before);
  });

  it("does not touch attributes when only non-type fields change", () => {
    const before = modelWithDomainAssignedToId();
    const { transaction } = updateDomainCascade(before, "d1", { description: "PII" }, "user-1");
    expect(transaction.operations).toHaveLength(1);
  });
});

describe("deleteDomainCascade", () => {
  it("unassigns the domain from every attribute before deleting it", () => {
    const before = modelWithDomainAssignedToId();
    const { model, transaction } = deleteDomainCascade(before, "d1", "user-1");
    expect(model.domains).toEqual([]);
    expect(model.entities[0]?.attributes[0]?.domainId).toBeUndefined();
    expect(transaction.operations.map((o) => o.type)).toEqual(["UnassignDomain", "DeleteDomain"]);
  });

  it("undoTransaction restores the attribute's domain link and the domain atomically", () => {
    const before = modelWithDomainAssignedToId();
    const { model, transaction } = deleteDomainCascade(before, "d1", "user-1");
    expect(undoTransaction(model, transaction)).toEqual(before);
  });
});
