import { describe, expect, it } from "vitest";
import { createMySqlDialect } from "./mysql.js";
import { createMySQLAdapter } from "./adapter.js";
import { shopModel } from "./test-fixtures.js";
import { toNativeSchema } from "./toNativeSchema.js";
import { renderSql } from "./render.js";

describe("createMySqlDialect", () => {
  const dialect = createMySqlDialect();

  it("maps ColumnType to MySQL types, including the UUID/BOOLEAN stand-ins", () => {
    expect(dialect.mapType("uuid")).toBe("char(36)");
    expect(dialect.mapType("boolean")).toBe("tinyint(1)");
    expect(dialect.mapType("string", 50)).toBe("varchar(50)");
    expect(dialect.mapType("float", 10, 2)).toBe("decimal(10, 2)");
  });

  it("mapTypeBack inverts mapType", () => {
    expect(dialect.mapTypeBack("char(36)")).toEqual({ type: "uuid" });
    expect(dialect.mapTypeBack("tinyint(1)")).toEqual({ type: "boolean" });
    expect(dialect.mapTypeBack("decimal(10, 2)")).toEqual({ type: "float", length: 10, scale: 2 });
  });

  it("quotes identifiers with backticks", () => {
    expect(dialect.quoteIdentifier("order")).toBe("`order`");
    expect(dialect.quoteIdentifier("weird`name")).toBe("`weird``name`");
  });

  it("supports ALTER TABLE for foreign keys, unlike SQLite", () => {
    expect(dialect.supportsAlterForeignKey).toBe(true);
  });

  it("renders a full schema via the shared createTableDDL/renderSql machinery", () => {
    const sql = renderSql(toNativeSchema(shopModel(), dialect), dialect);
    expect(sql).toContain("CREATE TABLE `customer`");
    expect(sql).toContain("ALTER TABLE `purchase_order` ADD CONSTRAINT");
  });

  it("appends AUTO_INCREMENT to an auto-increment column", () => {
    expect(
      dialect.columnDDL({ name: "id", type: "int", nullable: false, autoIncrement: true }),
    ).toBe("`id` int NOT NULL AUTO_INCREMENT");
  });
});

describe("createMySQLAdapter", () => {
  it("reports its kind as mysql", () => {
    const adapter = createMySQLAdapter({ execute: async () => {} });
    expect(adapter.kind).toBe("mysql");
  });
});
