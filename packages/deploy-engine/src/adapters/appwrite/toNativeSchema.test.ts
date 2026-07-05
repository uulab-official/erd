import { describe, expect, it } from "vitest";
import { toNativeSchema } from "./toNativeSchema.js";
import { shopModel } from "./test-fixtures.js";
import type { AppwriteAttributeDef } from "./types.js";

describe("toNativeSchema", () => {
  it("maps entities to collections and non-FK attributes to plain attributes", () => {
    const schema = toNativeSchema(shopModel());
    const customer = schema.collections.find((c) => c.id === "customer");
    expect(customer?.name).toBe("Customer");
    expect(customer?.attributes.map((a) => a.key)).toEqual(["id", "email", "orders"]);
  });

  it("excludes FK attributes and instead emits a relationship attribute on the source", () => {
    const schema = toNativeSchema(shopModel());
    const customer = schema.collections.find((c) => c.id === "customer");
    const order = schema.collections.find((c) => c.id === "order");

    expect(order?.attributes.some((a) => a.key === "customer_id")).toBe(false);
    const relAttr = customer?.attributes.find((a) => a.type === "relationship");
    expect(relAttr).toMatchObject({
      key: "orders",
      relatedCollection: "order",
      relationType: "oneToMany",
      onDelete: "cascade",
    });
  });

  it("maps a unique Index to a unique Appwrite index", () => {
    const schema = toNativeSchema(shopModel());
    const customer = schema.collections.find((c) => c.id === "customer");
    expect(customer?.indexes).toEqual([
      { key: "email_idx", type: "unique", attributes: ["email"] },
    ]);
  });

  it("falls back to a synthetic unique index for a composite primary key", () => {
    const model = shopModel();
    model.entities[1]!.attributes.push({
      ...model.entities[1]!.attributes[1]!,
      id: "id2",
      name: "id2",
      isPrimaryKey: true,
      isForeignKey: false,
    });
    const schema = toNativeSchema(model);
    const order = schema.collections.find((c) => c.id === "order");
    expect(order?.indexes).toContainEqual({
      key: "order_pk",
      type: "unique",
      attributes: ["order_id", "id2"],
    });
  });

  it("resolves a linked EnumType's values into the native attribute's elements", () => {
    const model = shopModel();
    model.enums = [{ id: "e1", name: "OrderStatus", values: ["pending", "shipped"] }];
    model.entities[1]!.attributes.push({
      id: "status",
      name: "status",
      logicalName: "Status",
      type: "enum",
      enumId: "e1",
      nullable: false,
      isPrimaryKey: false,
      isForeignKey: false,
      isUnique: false,
    });
    const schema = toNativeSchema(model);
    const order = schema.collections.find((c) => c.id === "order");
    const status = order?.attributes.find((a) => a.key === "status") as AppwriteAttributeDef;
    expect(status.type).toBe("enum");
    expect(status.elements).toEqual(["pending", "shipped"]);
  });

  it("falls back to a plain string attribute (not a broken elements-less enum) when enumId doesn't resolve", () => {
    const model = shopModel();
    model.entities[1]!.attributes.push({
      id: "status",
      name: "status",
      logicalName: "Status",
      type: "enum",
      enumId: "missing",
      nullable: false,
      isPrimaryKey: false,
      isForeignKey: false,
      isUnique: false,
    });
    const schema = toNativeSchema(model);
    const order = schema.collections.find((c) => c.id === "order");
    const status = order?.attributes.find((a) => a.key === "status") as AppwriteAttributeDef;
    expect(status.type).toBe("string");
    expect(status.elements).toBeUndefined();
  });
});
