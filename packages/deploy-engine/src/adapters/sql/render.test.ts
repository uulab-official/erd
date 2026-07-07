import { describe, expect, it } from "vitest";
import { createPostgresDialect } from "./dialect.js";
import { renderSql } from "./render.js";
import { toNativeSchema } from "./toNativeSchema.js";
import { shopModel } from "./test-fixtures.js";

describe("renderSql", () => {
  it("orders statements as tables, then indexes, then foreign keys", () => {
    const dialect = createPostgresDialect();
    const sql = renderSql(toNativeSchema(shopModel(), dialect), dialect);

    const createTableIdx = sql.indexOf("CREATE TABLE");
    const createIndexIdx = sql.indexOf("CREATE UNIQUE INDEX");
    const alterTableIdx = sql.indexOf("ALTER TABLE");

    expect(createTableIdx).toBeGreaterThanOrEqual(0);
    expect(createTableIdx).toBeLessThan(createIndexIdx);
    expect(createIndexIdx).toBeLessThan(alterTableIdx);
  });

  it("renders sequences before tables and views after everything else", () => {
    const dialect = createPostgresDialect();
    const model = shopModel();
    model.sequences = [{ id: "s1", name: "order_seq", start: 1, increment: 1 }];
    model.views = [{ id: "v1", name: "active_orders", sql: "SELECT * FROM purchase_order" }];
    const sql = renderSql(toNativeSchema(model, dialect), dialect);

    const createSequenceIdx = sql.indexOf("CREATE SEQUENCE");
    const createTableIdx = sql.indexOf("CREATE TABLE");
    const createViewIdx = sql.indexOf("CREATE VIEW");

    expect(createSequenceIdx).toBeGreaterThanOrEqual(0);
    expect(createSequenceIdx).toBeLessThan(createTableIdx);
    expect(createTableIdx).toBeLessThan(createViewIdx);
  });

  it("emits COMMENT ON COLUMN statements after CREATE TABLE for PostgreSQL", () => {
    const dialect = createPostgresDialect();
    const model = shopModel();
    model.entities[0]!.attributes[1]!.comment = "customer's primary email address";
    const sql = renderSql(toNativeSchema(model, dialect), dialect);

    expect(sql).toContain(
      `COMMENT ON COLUMN "customer"."email" IS 'customer''s primary email address';`,
    );
    expect(sql.indexOf("CREATE TABLE")).toBeLessThan(sql.indexOf("COMMENT ON COLUMN"));
  });
});
