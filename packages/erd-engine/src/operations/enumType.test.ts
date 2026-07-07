import { describe, expect, it } from "vitest";
import { applyInverse } from "./apply.js";
import { createEntity } from "./entity.js";
import {
  assignEnumToAttribute,
  createEnum,
  deleteEnum,
  unassignEnumFromAttribute,
  updateEnumValues,
} from "./enumType.js";
import { customerEntity, emptyModel } from "./test-fixtures.js";

function baseModel() {
  return createEntity(emptyModel(), customerEntity(), "user-1").model;
}

const STATUS = { id: "e1", name: "Status", values: ["active", "inactive"] };

describe("createEnum / deleteEnum", () => {
  it("creates an enum and its inverse removes it", () => {
    const before = baseModel();
    const { model, operation } = createEnum(before, { enumType: STATUS }, "user-1");
    expect(model.enums).toEqual([STATUS]);
    expect(applyInverse(model, operation)).toEqual(before);
  });

  it("throws when creating a duplicate id", () => {
    const before = createEnum(baseModel(), { enumType: STATUS }, "user-1").model;
    expect(() => createEnum(before, { enumType: STATUS }, "user-1")).toThrow();
  });

  it("throws when creating a duplicate name (different id)", () => {
    const before = createEnum(baseModel(), { enumType: STATUS }, "user-1").model;
    expect(() => createEnum(before, { enumType: { ...STATUS, id: "e2" } }, "user-1")).toThrow();
  });

  it("deleteEnum throws when an attribute is still assigned", () => {
    const withEnum = createEnum(baseModel(), { enumType: STATUS }, "user-1").model;
    const assigned = assignEnumToAttribute(
      withEnum,
      { entityId: "customer", attributeId: "id", enumId: "e1" },
      "user-1",
    ).model;
    expect(() => deleteEnum(assigned, { enumId: "e1" }, "user-1")).toThrow();
  });

  it("deleteEnum succeeds and its inverse restores it when unassigned", () => {
    const before = createEnum(baseModel(), { enumType: STATUS }, "user-1").model;
    const { model, operation } = deleteEnum(before, { enumId: "e1" }, "user-1");
    expect(model.enums).toEqual([]);
    expect(applyInverse(model, operation)).toEqual(before);
  });
});

describe("updateEnumValues", () => {
  it("updates the values and its inverse restores the original list", () => {
    const before = createEnum(baseModel(), { enumType: STATUS }, "user-1").model;
    const { model, operation } = updateEnumValues(
      before,
      { enumId: "e1", values: ["active", "inactive", "archived"] },
      "user-1",
    );
    expect(model.enums[0]?.values).toEqual(["active", "inactive", "archived"]);
    expect(applyInverse(model, operation)).toEqual(before);
  });
});

describe("assignEnumToAttribute / unassignEnumFromAttribute", () => {
  it("assigns an enum, forcing the attribute's type to enum, and its inverse restores both", () => {
    const before = createEnum(baseModel(), { enumType: STATUS }, "user-1").model;
    const { model, operation } = assignEnumToAttribute(
      before,
      { entityId: "customer", attributeId: "id", enumId: "e1" },
      "user-1",
    );
    const attribute = model.entities[0]?.attributes[0];
    expect(attribute).toMatchObject({ enumId: "e1", type: "enum" });
    expect(applyInverse(model, operation)).toEqual(before);
  });

  it("unassignEnumFromAttribute clears the link and leaves type untouched, inverse restores both", () => {
    const withEnum = createEnum(baseModel(), { enumType: STATUS }, "user-1").model;
    const assigned = assignEnumToAttribute(
      withEnum,
      { entityId: "customer", attributeId: "id", enumId: "e1" },
      "user-1",
    ).model;
    const { model, operation } = unassignEnumFromAttribute(
      assigned,
      { entityId: "customer", attributeId: "id" },
      "user-1",
    );
    const attribute = model.entities[0]?.attributes[0];
    expect(attribute?.enumId).toBeUndefined();
    expect(attribute?.type).toBe("enum"); // unassign only clears the link, not the type
    expect(applyInverse(model, operation)).toEqual(assigned);
  });

  it("throws for an unknown entity, attribute, or enum", () => {
    const before = createEnum(baseModel(), { enumType: STATUS }, "user-1").model;
    expect(() =>
      assignEnumToAttribute(
        before,
        { entityId: "missing", attributeId: "id", enumId: "e1" },
        "user-1",
      ),
    ).toThrow();
    expect(() =>
      assignEnumToAttribute(
        before,
        { entityId: "customer", attributeId: "missing", enumId: "e1" },
        "user-1",
      ),
    ).toThrow();
    expect(() =>
      assignEnumToAttribute(
        before,
        { entityId: "customer", attributeId: "id", enumId: "missing" },
        "user-1",
      ),
    ).toThrow();
  });
});
