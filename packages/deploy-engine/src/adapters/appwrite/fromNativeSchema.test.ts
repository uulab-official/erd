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
    expect(customer?.attributes.map((a) => a.id)).toEqual(["id", "email"]);
  });
});
