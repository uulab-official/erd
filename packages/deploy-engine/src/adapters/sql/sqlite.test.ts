import { describe, expect, it } from "vitest";
import { createSQLiteDialect } from "./sqlite.js";
import { createSQLiteAdapter } from "./adapter.js";
import { customerEntity, orderEntity, shopModel } from "./test-fixtures.js";
import { toNativeSchema } from "./toNativeSchema.js";
import { renderSql } from "./render.js";
import { planSqlDeployment } from "./plan.js";
import type { Model } from "@modelforge/schema-engine";

describe("createSQLiteDialect", () => {
  const dialect = createSQLiteDialect();

  it("does not support ALTER TABLE for foreign keys", () => {
    expect(dialect.supportsAlterForeignKey).toBe(false);
  });

  it("has no native sequence object, unlike PostgreSQL", () => {
    expect(dialect.supportsSequences).toBe(false);
    expect(dialect.createSequenceDDL({ name: "order_seq", start: 1, increment: 1 })).toBe("");
    expect(dialect.dropSequenceDDL("order_seq")).toBe("");
  });

  it("inlines foreign keys into CREATE TABLE instead of a separate ALTER TABLE", () => {
    const schema = toNativeSchema(shopModel(), dialect);
    const order = schema.tables.find((t) => t.name === "purchase_order")!;
    const ddl = dialect.createTableDDL(order);
    expect(ddl).toContain("FOREIGN KEY");
    expect(ddl).toContain('REFERENCES "customer"');
  });

  it("foreignKeyDDL returns an empty string (already inlined)", () => {
    const schema = toNativeSchema(shopModel(), dialect);
    const order = schema.tables.find((t) => t.name === "purchase_order")!;
    expect(dialect.foreignKeyDDL(order.foreignKeys[0]!, order.name)).toBe("");
  });

  it("renderSql never emits a standalone ALTER TABLE for foreign keys", () => {
    const sql = renderSql(toNativeSchema(shopModel(), dialect), dialect);
    expect(sql).not.toContain("ALTER TABLE");
  });

  it("inlines INTEGER PRIMARY KEY AUTOINCREMENT on the column, omitting a separate PRIMARY KEY line", () => {
    const ddl = dialect.createTableDDL({
      name: "widget",
      columns: [
        { name: "id", type: "integer", nullable: false, autoIncrement: true },
        { name: "name", type: "varchar(255)", nullable: false, default: null },
      ],
      primaryKey: ["id"],
      indexes: [],
      foreignKeys: [],
    });
    expect(ddl).toContain('"id" integer PRIMARY KEY AUTOINCREMENT');
    expect(ddl).not.toMatch(/PRIMARY KEY \(/);
  });

  it("still emits a separate PRIMARY KEY line for a composite key (no column is auto-increment)", () => {
    const ddl = dialect.createTableDDL({
      name: "widget_tag",
      columns: [
        { name: "widget_id", type: "integer", nullable: false },
        { name: "tag_id", type: "integer", nullable: false },
      ],
      primaryKey: ["widget_id", "tag_id"],
      indexes: [],
      foreignKeys: [],
    });
    expect(ddl).toContain('PRIMARY KEY ("widget_id", "tag_id")');
  });
});

describe("planSqlDeployment with SQLite", () => {
  const dialect = createSQLiteDialect();

  it("does not duplicate the inlined FK as a separate create-relationship step on create-table", () => {
    const plan = planSqlDeployment(shopModel(), null, dialect);
    expect(plan.steps.some((s) => s.action === "create-relationship")).toBe(false);
  });

  it("flags an ALTER-based FK addition as a manual-recreate warning instead of SQL", () => {
    const deployed: Model = {
      id: "shop",
      name: "Shop",
      adapter: "sqlite",
      entities: [customerEntity(), orderEntity()],
      relationships: [],
      views: [],
      sequences: [],
      enums: [],
    };
    const plan = planSqlDeployment(shopModel(), deployed, dialect);
    const step = plan.steps.find((s) => s.action === "create-relationship");
    expect(step?.sql).toBeUndefined();
    expect(step?.warning).toMatch(/does not support adding foreign keys/i);
  });

  it("stamps the plan's adapterKind as sqlite", () => {
    const plan = planSqlDeployment(shopModel(), null, dialect);
    expect(plan.adapterKind).toBe("sqlite");
  });
});

describe("createSQLiteAdapter", () => {
  it("reports its kind as sqlite", () => {
    const adapter = createSQLiteAdapter({ execute: async () => {} });
    expect(adapter.kind).toBe("sqlite");
  });
});
