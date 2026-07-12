import { describe, expect, it } from "vitest";
import {
  addAttribute,
  assignDomain,
  changeAttributeType,
  removeAttribute,
  renameAttribute,
  setAttributeComment,
  setAttributeDefault,
  setAttributeFlags,
  unassignDomain,
} from "./attribute.js";
import { createEntity } from "./entity.js";
import { createDomain } from "./governance.js";
import { createIndex } from "./indexes.js";
import { createRelationship } from "./relationship.js";
import { applyInverse } from "./apply.js";
import { customerEntity, emptyModel, orderEntity } from "./test-fixtures.js";
import type { Relationship } from "@modelforge/schema-engine";

function baseModel() {
  return createEntity(emptyModel(), customerEntity(), "user-1").model;
}

describe("addAttribute / removeAttribute", () => {
  it("adds an attribute and its inverse removes it", () => {
    const before = baseModel();
    const attribute = {
      id: "email",
      name: "email",
      logicalName: "Email",
      type: "string" as const,
      nullable: false,
      isPrimaryKey: false,
      isForeignKey: false,
      isUnique: true,
    };
    const { model, operation } = addAttribute(
      before,
      { entityId: "customer", attribute },
      "user-1",
    );
    expect(model.entities[0]?.attributes).toHaveLength(2);
    expect(applyInverse(model, operation)).toEqual(before);
  });

  it("removeAttribute's inverse restores the attribute at its original index", () => {
    const before = baseModel();
    const { model, operation } = removeAttribute(
      before,
      { entityId: "customer", attributeId: "id" },
      "user-1",
    );
    expect(model.entities[0]?.attributes).toHaveLength(0);
    expect(applyInverse(model, operation)).toEqual(before);
  });

  it("rejects removing an attribute still referenced by a relationship", () => {
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
    model = createRelationship(model, relationship, "user-1").model;
    expect(() =>
      removeAttribute(model, { entityId: "order", attributeId: "customer_id" }, "user-1"),
    ).toThrow(/still referenced by a relationship/);
  });

  it("rejects removing an attribute still referenced by an index", () => {
    let model = createEntity(emptyModel(), customerEntity(), "user-1").model;
    model = createIndex(
      model,
      {
        entityId: "customer",
        index: { id: "idx1", name: "idx_customer_id", attributeIds: ["id"], unique: true },
      },
      "user-1",
    ).model;
    expect(() =>
      removeAttribute(model, { entityId: "customer", attributeId: "id" }, "user-1"),
    ).toThrow(/still referenced by an index/);
  });
});

describe("renameAttribute", () => {
  it("renames and its inverse restores the original name", () => {
    const before = baseModel();
    const { model, operation } = renameAttribute(
      before,
      { entityId: "customer", attributeId: "id", logicalName: "Identifier" },
      "user-1",
    );
    expect(model.entities[0]?.attributes[0]?.logicalName).toBe("Identifier");
    expect(applyInverse(model, operation)).toEqual(before);
  });
});

describe("changeAttributeType", () => {
  it("changes type/length and its inverse restores them", () => {
    const before = baseModel();
    const { model, operation } = changeAttributeType(
      before,
      { entityId: "customer", attributeId: "id", type: "string", length: 36 },
      "user-1",
    );
    expect(model.entities[0]?.attributes[0]?.type).toBe("string");
    expect(applyInverse(model, operation)).toEqual(before);
  });
});

describe("setAttributeFlags", () => {
  it("updates only the given flags and its inverse restores them", () => {
    const before = baseModel();
    const { model, operation } = setAttributeFlags(
      before,
      { entityId: "customer", attributeId: "id", flags: { isUnique: false } },
      "user-1",
    );
    expect(model.entities[0]?.attributes[0]?.isUnique).toBe(false);
    expect(model.entities[0]?.attributes[0]?.isPrimaryKey).toBe(true);
    expect(applyInverse(model, operation)).toEqual(before);
  });
});

describe("setAttributeDefault", () => {
  it("sets a default and its inverse restores the previous one", () => {
    const before = baseModel();
    const { model, operation } = setAttributeDefault(
      before,
      { entityId: "customer", attributeId: "id", default: "uuid_generate_v4()" },
      "user-1",
    );
    expect(model.entities[0]?.attributes[0]?.default).toBe("uuid_generate_v4()");
    expect(applyInverse(model, operation)).toEqual(before);
  });
});

describe("setAttributeComment", () => {
  it("sets a comment and its inverse restores the previous one", () => {
    const before = baseModel();
    const { model, operation } = setAttributeComment(
      before,
      { entityId: "customer", attributeId: "id", comment: "primary key, generated by the DB" },
      "user-1",
    );
    expect(model.entities[0]?.attributes[0]?.comment).toBe("primary key, generated by the DB");
    expect(applyInverse(model, operation)).toEqual(before);
  });

  it("can clear a comment back to undefined, and its inverse restores it", () => {
    const withComment = setAttributeComment(
      baseModel(),
      { entityId: "customer", attributeId: "id", comment: "note" },
      "user-1",
    ).model;
    const { model, operation } = setAttributeComment(
      withComment,
      { entityId: "customer", attributeId: "id", comment: undefined },
      "user-1",
    );
    expect(model.entities[0]?.attributes[0]?.comment).toBeUndefined();
    expect(applyInverse(model, operation)).toEqual(withComment);
  });
});

const EMAIL_DOMAIN = { id: "d1", name: "Email", type: "string" as const, length: 320 };

describe("assignDomain / unassignDomain", () => {
  it("syncs type/length/scale from the domain and its inverse restores the prior values", () => {
    const before = createDomain(baseModel(), { domain: EMAIL_DOMAIN }, "user-1").model;
    const { model, operation } = assignDomain(
      before,
      { entityId: "customer", attributeId: "id", domainId: "d1" },
      "user-1",
    );
    expect(model.entities[0]?.attributes[0]).toMatchObject({
      domainId: "d1",
      type: "string",
      length: 320,
    });
    expect(applyInverse(model, operation)).toEqual(before);
  });

  it("rejects assigning a domain that doesn't exist", () => {
    const before = baseModel();
    expect(() =>
      assignDomain(
        before,
        { entityId: "customer", attributeId: "id", domainId: "missing" },
        "user-1",
      ),
    ).toThrow();
  });

  it("unassigning clears domainId but leaves type/length/scale as-is", () => {
    const withDomain = createDomain(baseModel(), { domain: EMAIL_DOMAIN }, "user-1").model;
    const before = assignDomain(
      withDomain,
      { entityId: "customer", attributeId: "id", domainId: "d1" },
      "user-1",
    ).model;
    const { model, operation } = unassignDomain(
      before,
      { entityId: "customer", attributeId: "id" },
      "user-1",
    );
    expect(model.entities[0]?.attributes[0]).toMatchObject({
      domainId: undefined,
      type: "string",
      length: 320,
    });
    expect(applyInverse(model, operation)).toEqual(before);
  });

  it("re-assigning a different domain inverts back to the original domain link", () => {
    const withDomains = createDomain(baseModel(), { domain: EMAIL_DOMAIN }, "user-1").model;
    const secondDomain = { id: "d2", name: "Note", type: "string" as const, length: 1000 };
    const withBothDomains = createDomain(withDomains, { domain: secondDomain }, "user-1").model;
    const before = assignDomain(
      withBothDomains,
      { entityId: "customer", attributeId: "id", domainId: "d1" },
      "user-1",
    ).model;

    const { model, operation } = assignDomain(
      before,
      { entityId: "customer", attributeId: "id", domainId: "d2" },
      "user-1",
    );
    expect(model.entities[0]?.attributes[0]?.domainId).toBe("d2");
    expect(applyInverse(model, operation)).toEqual(before);
  });
});
