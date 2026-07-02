import { describe, expect, it } from "vitest";
import {
  addAttribute,
  changeAttributeType,
  removeAttribute,
  renameAttribute,
  setAttributeDefault,
  setAttributeFlags,
} from "./attribute.js";
import { createEntity } from "./entity.js";
import { applyInverse } from "./apply.js";
import { customerEntity, emptyModel } from "./test-fixtures.js";

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
