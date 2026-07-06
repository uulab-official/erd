import { describe, expect, it } from "vitest";
import { toNativeSchema } from "./toNativeSchema.js";
import { fromNativeSchema } from "./fromNativeSchema.js";
import { shopModel } from "./test-fixtures.js";

describe("fromNativeSchema", () => {
  it("reconstructs collections as entities and relationship attributes as relationships", () => {
    const schema = toNativeSchema(shopModel());
    const model = fromNativeSchema(schema);

    expect(model.entities.map((e) => e.id)).toEqual(["customer", "order"]);
    expect(model.relationships).toHaveLength(1);
    expect(model.relationships[0]).toMatchObject({
      sourceEntityId: "customer",
      targetEntityId: "order",
      cardinality: "one-to-many",
      onDelete: "cascade",
    });
  });

  it("does not resurrect relationship attributes as plain entity attributes", () => {
    const schema = toNativeSchema(shopModel());
    const model = fromNativeSchema(schema);
    const customer = model.entities.find((e) => e.id === "customer");
    expect(customer?.attributes.map((a) => a.name)).toEqual(["id", "email"]);
  });

  it("synthesizes an implicit $id primary key when the export has none", () => {
    const model = fromNativeSchema({
      collections: [
        {
          id: "widget",
          name: "Widget",
          attributes: [{ key: "title", type: "string", required: true, array: false, size: 100 }],
          indexes: [],
        },
      ],
    });
    const widget = model.entities[0]!;
    expect(widget.attributes.map((a) => a.name)).toEqual(["id", "title"]);
    expect(widget.attributes[0]).toMatchObject({ isPrimaryKey: true, isUnique: true });
  });

  it("does not add a synthetic id when the export already has an 'id' attribute", () => {
    const model = fromNativeSchema({
      collections: [
        {
          id: "widget",
          name: "Widget",
          attributes: [
            { key: "id", type: "string", required: true, array: false, size: 36 },
            { key: "title", type: "string", required: true, array: false, size: 100 },
          ],
          indexes: [],
        },
      ],
    });
    const widget = model.entities[0]!;
    expect(widget.attributes).toHaveLength(2);
    expect(widget.attributes[0]?.isPrimaryKey).toBe(false);
  });

  it("reconstructs a real EnumType from a native enum attribute's elements and links it via enumId", () => {
    const model = fromNativeSchema({
      collections: [
        {
          id: "order",
          name: "Order",
          attributes: [
            {
              key: "status",
              type: "enum",
              required: true,
              array: false,
              elements: ["pending", "shipped"],
            },
          ],
          indexes: [],
        },
      ],
    });
    const status = model.entities[0]!.attributes.find((a) => a.name === "status");
    expect(status?.type).toBe("enum");
    expect(status?.enumId).toBe("order.status");
    expect(model.enums).toContainEqual({
      id: "order.status",
      name: "status",
      values: ["pending", "shipped"],
    });
  });

  it("round-trips a linked EnumType through toNativeSchema -> fromNativeSchema", () => {
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
    const roundTripped = fromNativeSchema(toNativeSchema(model));
    const status = roundTripped.entities
      .find((e) => e.id === "order")
      ?.attributes.find((a) => a.name === "status");
    const enumType = roundTripped.enums.find((e) => e.id === status?.enumId);
    expect(enumType?.values).toEqual(["pending", "shipped"]);
  });
});
