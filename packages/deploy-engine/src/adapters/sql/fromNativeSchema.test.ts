import { describe, expect, it } from "vitest";
import { createPostgresDialect } from "./dialect.js";
import { toNativeSchema } from "./toNativeSchema.js";
import { fromNativeSchema } from "./fromNativeSchema.js";
import { shopModel } from "./test-fixtures.js";

describe("fromNativeSchema (SQL)", () => {
  const dialect = createPostgresDialect();

  it("round-trips tables/columns/foreign keys back into entities and relationships", () => {
    const schema = toNativeSchema(shopModel(), dialect);
    const model = fromNativeSchema(schema, dialect);

    expect(model.entities.map((e) => e.id)).toEqual(["customer", "purchase_order"]);
    expect(model.relationships).toHaveLength(1);
    expect(model.relationships[0]).toMatchObject({
      sourceEntityId: "customer",
      targetEntityId: "purchase_order",
      onDelete: "cascade",
    });
  });

  it("flags the FK column as isForeignKey and marks primaryKey columns", () => {
    const schema = toNativeSchema(shopModel(), dialect);
    const model = fromNativeSchema(schema, dialect);
    const order = model.entities.find((e) => e.id === "purchase_order");
    expect(order?.attributes.find((a) => a.name === "customer_id")?.isForeignKey).toBe(true);
    expect(order?.attributes.find((a) => a.name === "id")?.isPrimaryKey).toBe(true);
  });

  it("round-trips sequences and views back into the Model instead of dropping them", () => {
    const before = shopModel();
    before.sequences = [{ id: "s1", name: "order_seq", start: 1, increment: 1 }];
    before.views = [{ id: "v1", name: "active_orders", sql: "SELECT * FROM purchase_order" }];

    const schema = toNativeSchema(before, dialect);
    const model = fromNativeSchema(schema, dialect);

    expect(model.sequences).toEqual([
      { id: "order_seq", name: "order_seq", start: 1, increment: 1 },
    ]);
    expect(model.views).toEqual([
      { id: "active_orders", name: "active_orders", sql: "SELECT * FROM purchase_order" },
    ]);
  });
});
