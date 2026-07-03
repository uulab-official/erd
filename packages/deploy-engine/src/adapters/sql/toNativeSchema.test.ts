import { describe, expect, it } from "vitest";
import { createPostgresDialect } from "./dialect.js";
import { toNativeSchema } from "./toNativeSchema.js";
import { customerEntity, shopModel } from "./test-fixtures.js";
import type { Model } from "@modelforge/schema-engine";

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

  it("does not mark a uuid primary key as auto-increment", () => {
    const schema = toNativeSchema(shopModel(), dialect);
    const customer = schema.tables.find((t) => t.name === "customer");
    expect(customer?.columns.find((c) => c.name === "id")?.autoIncrement).toBeUndefined();
  });

  function modelWithIntegerPk(
    overrides: Partial<Model["entities"][number]["attributes"][number]> = {},
  ) {
    const entity = customerEntity();
    entity.attributes = entity.attributes.map((a) =>
      a.isPrimaryKey ? { ...a, type: "integer", ...overrides } : a,
    );
    const model: Model = {
      id: "m",
      name: "M",
      adapter: "postgresql",
      entities: [entity],
      relationships: [],
      views: [],
      sequences: [],
      enums: [],
    };
    return model;
  }

  it("marks a sole integer primary key with no explicit default as auto-increment", () => {
    const schema = toNativeSchema(modelWithIntegerPk(), dialect);
    expect(schema.tables[0]?.columns.find((c) => c.name === "id")?.autoIncrement).toBe(true);
  });

  it("does not mark it auto-increment when an explicit default is set", () => {
    const schema = toNativeSchema(modelWithIntegerPk({ default: 1 }), dialect);
    expect(schema.tables[0]?.columns.find((c) => c.name === "id")?.autoIncrement).toBeUndefined();
  });

  it("does not mark any column auto-increment for a composite primary key", () => {
    const entity = customerEntity();
    entity.attributes = entity.attributes.map((a) => ({
      ...a,
      type: a.isPrimaryKey ? "integer" : a.type,
      isPrimaryKey: true,
    }));
    const model: Model = {
      id: "m",
      name: "M",
      adapter: "postgresql",
      entities: [entity],
      relationships: [],
      views: [],
      sequences: [],
      enums: [],
    };
    const schema = toNativeSchema(model, dialect);
    expect(schema.tables[0]?.columns.every((c) => !c.autoIncrement)).toBe(true);
  });
});
