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
});
