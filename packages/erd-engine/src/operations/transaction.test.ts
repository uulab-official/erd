import { describe, expect, it } from "vitest";
import { assignDomain } from "./attribute.js";
import { createEntity } from "./entity.js";
import { assignEnumToAttribute, createEnum } from "./enumType.js";
import { createDomain } from "./governance.js";
import { createRelationship } from "./relationship.js";
import { assignEntityToSubjectArea, createSubjectArea } from "./subjectArea.js";
import { createIndex } from "./indexes.js";
import {
  connectEntitiesCascade,
  deleteDomainCascade,
  deleteEntityCascade,
  deleteEnumCascade,
  deleteSubjectAreaCascade,
  moveEntitiesTransaction,
  redoTransaction,
  removeAttributeCascade,
  undoTransaction,
  updateDomainCascade,
} from "./transaction.js";
import { customerEntity, emptyModel, orderEntity } from "./test-fixtures.js";
import type { Entity, Relationship } from "@modelforge/schema-engine";

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

  it("unassigns the entity from its Subject Area before deleting it", () => {
    let before = createEntity(emptyModel(), customerEntity(), "user-1").model;
    before = createSubjectArea(
      before,
      { subjectArea: { id: "sa1", name: "Core", entityIds: [] } },
      "user-1",
    ).model;
    before = assignEntityToSubjectArea(
      before,
      { entityId: "customer", subjectAreaId: "sa1" },
      "user-1",
    ).model;

    const { model, transaction } = deleteEntityCascade(before, "customer", "user-1");
    expect(model.entities).toEqual([]);
    expect(model.subjectAreas?.[0]?.entityIds).toEqual([]);
    expect(transaction.operations.map((o) => o.type)).toEqual([
      "UnassignEntityFromSubjectArea",
      "DeleteEntity",
    ]);
    expect(undoTransaction(model, transaction)).toEqual(before);
  });
});

describe("removeAttributeCascade", () => {
  it("deletes the referencing relationship before the attribute", () => {
    const before = modelWithRelationship();
    const { model, transaction } = removeAttributeCascade(before, "order", "customer_id", "user-1");
    expect(model.relationships).toEqual([]);
    expect(model.entities.find((e) => e.id === "order")?.attributes).toHaveLength(1);
    expect(transaction.operations.map((o) => o.type)).toEqual([
      "DeleteRelationship",
      "RemoveAttribute",
    ]);
  });

  it("deletes a referencing index before the attribute", () => {
    let before = createEntity(emptyModel(), customerEntity(), "user-1").model;
    before = createIndex(
      before,
      {
        entityId: "customer",
        index: { id: "idx1", name: "idx_customer_id", attributeIds: ["id"], unique: true },
      },
      "user-1",
    ).model;
    const { model, transaction } = removeAttributeCascade(before, "customer", "id", "user-1");
    expect(model.entities[0]?.indexes).toEqual([]);
    expect(model.entities[0]?.attributes).toEqual([]);
    expect(transaction.operations.map((o) => o.type)).toEqual(["DeleteIndex", "RemoveAttribute"]);
  });

  it("undoTransaction restores the attribute, its index, and its relationship atomically", () => {
    const before = modelWithRelationship();
    const { model, transaction } = removeAttributeCascade(before, "order", "customer_id", "user-1");
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

function blankOrderEntity(): Entity {
  return {
    id: "order",
    logicalName: "Order",
    physicalName: "order",
    tags: [],
    attributes: [
      {
        id: "order_id",
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
    ui: { x: 280, y: 0 },
  };
}

function twoEntityModel() {
  let model = createEntity(emptyModel(), customerEntity(), "user-1").model;
  model = createEntity(model, blankOrderEntity(), "user-1").model;
  return model;
}

describe("connectEntitiesCascade", () => {
  it("creates a foreign key attribute on the target mirroring the source's primary key, then the relationship", () => {
    const before = twoEntityModel();
    const { model, transaction } = connectEntitiesCascade(
      before,
      {
        sourceEntityId: "customer",
        targetEntityId: "order",
        relationshipId: "r1",
        foreignKeyAttributeId: "fk1",
      },
      "user-1",
    );

    expect(transaction.operations.map((o) => o.type)).toEqual([
      "AddAttribute",
      "CreateRelationship",
    ]);
    const order = model.entities.find((e) => e.id === "order")!;
    const fk = order.attributes.find((a) => a.id === "fk1");
    expect(fk).toMatchObject({
      name: "customer_id",
      logicalName: "Customer ID",
      type: "uuid",
      isForeignKey: true,
      isPrimaryKey: false,
      nullable: false,
    });
    expect(model.relationships).toEqual([
      {
        id: "r1",
        name: undefined,
        sourceEntityId: "customer",
        targetEntityId: "order",
        cardinality: "one-to-many",
        kind: "non-identifying",
        optionality: "mandatory",
        sourceAttributeIds: ["id"],
        targetAttributeIds: ["fk1"],
      },
    ]);
  });

  it("undoTransaction removes both the relationship and the foreign key attribute atomically", () => {
    const before = twoEntityModel();
    const { model, transaction } = connectEntitiesCascade(
      before,
      {
        sourceEntityId: "customer",
        targetEntityId: "order",
        relationshipId: "r1",
        foreignKeyAttributeId: "fk1",
      },
      "user-1",
    );
    expect(undoTransaction(model, transaction)).toEqual(before);
  });

  it("redoTransaction re-applies both steps", () => {
    const before = twoEntityModel();
    const { model, transaction } = connectEntitiesCascade(
      before,
      {
        sourceEntityId: "customer",
        targetEntityId: "order",
        relationshipId: "r1",
        foreignKeyAttributeId: "fk1",
      },
      "user-1",
    );
    const undone = undoTransaction(model, transaction);
    expect(redoTransaction(undone, transaction)).toEqual(model);
  });

  it("marks the foreign key nullable and unique for an optional one-to-one connection", () => {
    const before = twoEntityModel();
    const { model } = connectEntitiesCascade(
      before,
      {
        sourceEntityId: "customer",
        targetEntityId: "order",
        relationshipId: "r1",
        foreignKeyAttributeId: "fk1",
        cardinality: "one-to-one",
        optionality: "optional",
      },
      "user-1",
    );
    const order = model.entities.find((e) => e.id === "order")!;
    expect(order.attributes.find((a) => a.id === "fk1")).toMatchObject({
      nullable: true,
      isUnique: true,
    });
  });

  it("rejects connecting to/from an unknown entity", () => {
    const before = twoEntityModel();
    expect(() =>
      connectEntitiesCascade(
        before,
        {
          sourceEntityId: "missing",
          targetEntityId: "order",
          relationshipId: "r1",
          foreignKeyAttributeId: "fk1",
        },
        "user-1",
      ),
    ).toThrow();
  });

  it("rejects a source entity with no primary key", () => {
    const noPkEntity: Entity = { ...customerEntity(), attributes: [] };
    const before = createEntity(
      createEntity(emptyModel(), noPkEntity, "user-1").model,
      blankOrderEntity(),
      "user-1",
    ).model;
    expect(() =>
      connectEntitiesCascade(
        before,
        {
          sourceEntityId: "customer",
          targetEntityId: "order",
          relationshipId: "r1",
          foreignKeyAttributeId: "fk1",
        },
        "user-1",
      ),
    ).toThrow("no primary key");
  });

  it("rejects a source entity with a composite primary key", () => {
    const compositeEntity: Entity = {
      ...customerEntity(),
      attributes: [
        ...customerEntity().attributes,
        {
          id: "region",
          name: "region",
          logicalName: "Region",
          type: "string",
          nullable: false,
          isPrimaryKey: true,
          isForeignKey: false,
          isUnique: false,
        },
      ],
    };
    const before = createEntity(
      createEntity(emptyModel(), compositeEntity, "user-1").model,
      blankOrderEntity(),
      "user-1",
    ).model;
    expect(() =>
      connectEntitiesCascade(
        before,
        {
          sourceEntityId: "customer",
          targetEntityId: "order",
          relationshipId: "r1",
          foreignKeyAttributeId: "fk1",
        },
        "user-1",
      ),
    ).toThrow("composite primary key");
  });
});

describe("moveEntitiesTransaction", () => {
  it("moves every covered entity and undoes back to the original arrangement", () => {
    const before = createEntity(
      createEntity(emptyModel(), customerEntity(), "user-1").model,
      orderEntity(),
      "user-1",
    ).model;
    const { model, transaction } = moveEntitiesTransaction(
      before,
      { customer: { x: 100, y: 50 }, order: { x: 460, y: 50 } },
      "user-1",
    );
    expect(model.entities.map((e) => e.ui)).toEqual([
      { x: 100, y: 50 },
      { x: 460, y: 50 },
    ]);
    expect(transaction.operations).toHaveLength(2);
    expect(undoTransaction(model, transaction)).toEqual(before);
  });

  it("skips entities already at their target and ids not in the positions map", () => {
    const before = createEntity(
      createEntity(emptyModel(), customerEntity(), "user-1").model,
      orderEntity(),
      "user-1",
    ).model;
    // customer starts at (0,0) — same target means no Operation; order isn't covered.
    const { model, transaction } = moveEntitiesTransaction(
      before,
      { customer: { x: 0, y: 0 } },
      "user-1",
    );
    expect(transaction.operations).toHaveLength(0);
    expect(model).toEqual(before);
  });

  it("redoTransaction replays the layout", () => {
    const before = createEntity(emptyModel(), customerEntity(), "user-1").model;
    const { model, transaction } = moveEntitiesTransaction(
      before,
      { customer: { x: 300, y: 200 } },
      "user-1",
    );
    const undone = undoTransaction(model, transaction);
    expect(redoTransaction(undone, transaction)).toEqual(model);
  });
});

describe("deleteSubjectAreaCascade", () => {
  it("unassigns every member entity before deleting the subject area", () => {
    const withArea = createEntity(
      createEntity(emptyModel(), customerEntity(), "user-1").model,
      orderEntity(),
      "user-1",
    ).model;
    const created = createSubjectArea(
      withArea,
      { subjectArea: { id: "sa1", name: "Sales", entityIds: [] } },
      "user-1",
    ).model;
    const assigned = assignEntityToSubjectArea(
      assignEntityToSubjectArea(created, { entityId: "customer", subjectAreaId: "sa1" }, "user-1")
        .model,
      { entityId: "order", subjectAreaId: "sa1" },
      "user-1",
    ).model;

    const { model, transaction } = deleteSubjectAreaCascade(assigned, "sa1", "user-1");
    expect(model.subjectAreas).toEqual([]);
    expect(model.entities.every((e) => e.subjectAreaId === undefined)).toBe(true);
    expect(transaction.operations.map((o) => o.type)).toEqual([
      "UnassignEntityFromSubjectArea",
      "UnassignEntityFromSubjectArea",
      "DeleteSubjectArea",
    ]);
  });

  it("undoTransaction restores the subject area and every member atomically", () => {
    const withArea = createEntity(emptyModel(), customerEntity(), "user-1").model;
    const created = createSubjectArea(
      withArea,
      { subjectArea: { id: "sa1", name: "Sales", entityIds: [] } },
      "user-1",
    ).model;
    const assigned = assignEntityToSubjectArea(
      created,
      { entityId: "customer", subjectAreaId: "sa1" },
      "user-1",
    ).model;
    const { model, transaction } = deleteSubjectAreaCascade(assigned, "sa1", "user-1");
    expect(undoTransaction(model, transaction)).toEqual(assigned);
  });
});

describe("deleteEnumCascade", () => {
  it("unassigns every attribute referencing the enum before deleting it", () => {
    const withEntity = createEntity(
      createEntity(emptyModel(), customerEntity(), "user-1").model,
      orderEntity(),
      "user-1",
    ).model;
    const withEnum = createEnum(
      withEntity,
      { enumType: { id: "e1", name: "Status", values: ["active", "inactive"] } },
      "user-1",
    ).model;
    const assigned = assignEnumToAttribute(
      assignEnumToAttribute(
        withEnum,
        { entityId: "customer", attributeId: "id", enumId: "e1" },
        "user-1",
      ).model,
      { entityId: "order", attributeId: "id", enumId: "e1" },
      "user-1",
    ).model;

    const { model, transaction } = deleteEnumCascade(assigned, "e1", "user-1");
    expect(model.enums).toEqual([]);
    expect(model.entities.every((e) => e.attributes.every((a) => a.enumId === undefined))).toBe(
      true,
    );
    expect(transaction.operations.map((o) => o.type)).toEqual([
      "UnassignEnumFromAttribute",
      "UnassignEnumFromAttribute",
      "DeleteEnum",
    ]);
  });

  it("undoTransaction restores the enum and every assignment atomically", () => {
    const withEntity = createEntity(emptyModel(), customerEntity(), "user-1").model;
    const withEnum = createEnum(
      withEntity,
      { enumType: { id: "e1", name: "Status", values: ["active", "inactive"] } },
      "user-1",
    ).model;
    const assigned = assignEnumToAttribute(
      withEnum,
      { entityId: "customer", attributeId: "id", enumId: "e1" },
      "user-1",
    ).model;
    const { model, transaction } = deleteEnumCascade(assigned, "e1", "user-1");
    expect(undoTransaction(model, transaction)).toEqual(assigned);
  });
});
