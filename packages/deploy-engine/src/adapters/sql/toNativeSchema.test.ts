import { describe, expect, it } from "vitest";
import { createPostgresDialect } from "./dialect.js";
import { createMySqlDialect } from "./mysql.js";
import { toNativeSchema } from "./toNativeSchema.js";
import { customerEntity, shopModel } from "./test-fixtures.js";
import type { Model } from "@modelforge/schema-engine";

function modelWithEnumAttribute(): Model {
  const entity = customerEntity();
  entity.attributes.push({
    id: "customer_status",
    name: "status",
    logicalName: "Status",
    type: "enum",
    enumId: "e1",
    nullable: false,
    isPrimaryKey: false,
    isForeignKey: false,
    isUnique: false,
  });
  return {
    id: "m",
    name: "M",
    adapter: "postgresql",
    entities: [entity],
    relationships: [],
    views: [],
    sequences: [],
    enums: [{ id: "e1", name: "Status", values: ["pending", "shipped"] }],
  };
}

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

  it("carries a linked EnumType's values as checkValues for a dialect with no native enum type", () => {
    const schema = toNativeSchema(modelWithEnumAttribute(), dialect);
    const status = schema.tables[0]?.columns.find((c) => c.name === "status");
    expect(status?.type).toBe("text");
    expect(status?.checkValues).toEqual(["pending", "shipped"]);
  });

  it("bakes the values into the column type for a dialect with a native enum type (MySQL)", () => {
    const schema = toNativeSchema(modelWithEnumAttribute(), createMySqlDialect());
    const status = schema.tables[0]?.columns.find((c) => c.name === "status");
    expect(status?.type).toBe("enum('pending', 'shipped')");
    expect(status?.checkValues).toBeUndefined();
  });

  it("falls back to a plain enum column with no checkValues when enumId doesn't resolve", () => {
    const model = modelWithEnumAttribute();
    model.entities[0]!.attributes[2]!.enumId = "missing";
    const schema = toNativeSchema(model, dialect);
    const status = schema.tables[0]?.columns.find((c) => c.name === "status");
    expect(status?.type).toBe("text");
    expect(status?.checkValues).toBeUndefined();
  });

  it("maps Model.sequences through to SqlSequenceDef", () => {
    const model = shopModel();
    model.sequences = [{ id: "s1", name: "order_seq", start: 100, increment: 5 }];
    const schema = toNativeSchema(model, dialect);
    expect(schema.sequences).toEqual([{ name: "order_seq", start: 100, increment: 5 }]);
  });

  it("maps a View with sql through to SqlViewDef, skipping one with no sql", () => {
    const model = shopModel();
    model.views = [
      { id: "v1", name: "active_orders", sql: "SELECT * FROM purchase_order" },
      { id: "v2", name: "no_sql_yet" },
    ];
    const schema = toNativeSchema(model, dialect);
    expect(schema.views).toEqual([{ name: "active_orders", sql: "SELECT * FROM purchase_order" }]);
  });

  it("carries Attribute.comment through to SqlColumnDef.comment", () => {
    const model = shopModel();
    model.entities[0]!.attributes[1]!.comment = "customer's primary email address";
    const schema = toNativeSchema(model, dialect);
    const customer = schema.tables.find((t) => t.name === "customer");
    expect(customer?.columns.find((c) => c.name === "email")?.comment).toBe(
      "customer's primary email address",
    );
  });

  it("omits comment from SqlColumnDef when the attribute has none", () => {
    const schema = toNativeSchema(shopModel(), dialect);
    const customer = schema.tables.find((t) => t.name === "customer");
    expect(customer?.columns.find((c) => c.name === "email")?.comment).toBeUndefined();
  });
});
