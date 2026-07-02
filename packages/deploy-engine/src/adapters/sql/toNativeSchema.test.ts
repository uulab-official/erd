import { describe, expect, it } from "vitest";
import { createPostgresDialect } from "./dialect.js";
import { toNativeSchema } from "./toNativeSchema.js";
import { shopModel } from "./test-fixtures.js";

describe("toNativeSchema (SQL)", () => {
  const dialect = createPostgresDialect();

  it("maps entities to tables including every attribute (FKs stay plain columns)", () => {
    const schema = toNativeSchema(shopModel(), dialect);
    const order = schema.tables.find((t) => t.name === "purchase_order");
    expect(order?.columns.map((c) => c.name)).toEqual(["id", "customer_id"]);
  });

  it("maps a unique Index to a unique SQL index", () => {
    const schema = toNativeSchema(shopModel(), dialect);
    const customer = schema.tables.find((t) => t.name === "customer");
    expect(customer?.indexes).toEqual([{ name: "email_idx", unique: true, columns: ["email"] }]);
  });

  it("builds a foreign key on the target ('many') side referencing the source", () => {
    const schema = toNativeSchema(shopModel(), dialect);
    const order = schema.tables.find((t) => t.name === "purchase_order");
    expect(order?.foreignKeys).toEqual([
      {
        name: "fk_purchase_order_places",
        columns: ["customer_id"],
        referencedTable: "customer",
        referencedColumns: ["id"],
        onDelete: "cascade",
        onUpdate: "no-action",
      },
    ]);
  });

  it("sets primaryKey from isPrimaryKey attributes", () => {
    const schema = toNativeSchema(shopModel(), dialect);
    expect(schema.tables.map((t) => t.primaryKey)).toEqual([["id"], ["id"]]);
  });
});
