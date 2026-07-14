import { describe, expect, it } from "vitest";
import { createMySqlDialect } from "./mysql.js";
import { createMySQLAdapter } from "./adapter.js";
import { customerEntity, shopModel } from "./test-fixtures.js";
import { toNativeSchema } from "./toNativeSchema.js";
import { renderSql } from "./render.js";
import { planSqlDeployment } from "./plan.js";

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
    expect(dialect.mapTypeBack("enum('a', 'b')")).toEqual({ type: "enum" });
  });

  it("renders a native enum(...) column type, escaping embedded quotes", () => {
    expect(dialect.enumColumnType?.(["pending", "it's done"])).toBe(
      "enum('pending', 'it''s done')",
    );
  });

  it("quotes identifiers with backticks", () => {
    expect(dialect.quoteIdentifier("order")).toBe("`order`");
    expect(dialect.quoteIdentifier("weird`name")).toBe("`weird``name`");
  });

  it("supports ALTER TABLE for foreign keys, unlike SQLite", () => {
    expect(dialect.supportsAlterForeignKey).toBe(true);
  });

  it("has no native sequence object, unlike PostgreSQL", () => {
    expect(dialect.supportsSequences).toBe(false);
    expect(dialect.createSequenceDDL({ name: "order_seq", start: 1, increment: 1 })).toBe("");
    expect(dialect.dropSequenceDDL("order_seq")).toBe("");
  });

  it("renders CREATE VIEW/DROP VIEW with backtick quoting", () => {
    expect(dialect.createViewDDL({ name: "active_orders", sql: "SELECT * FROM orders" })).toBe(
      "CREATE VIEW `active_orders` AS SELECT * FROM orders;",
    );
    expect(dialect.dropViewDDL("active_orders")).toBe("DROP VIEW `active_orders`;");
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

  it("renders USING BTREE/HASH after the column list, and a separate FULLTEXT INDEX statement", () => {
    expect(
      dialect.createIndexDDL(
        { name: "email_idx", unique: false, columns: ["email"], method: "hash" },
        "customer",
      ),
    ).toBe("CREATE INDEX `email_idx` ON `customer` (`email`) USING HASH;");
    expect(
      dialect.createIndexDDL(
        { name: "email_idx", unique: false, columns: ["email"], method: "fulltext" },
        "customer",
      ),
    ).toBe("CREATE FULLTEXT INDEX `email_idx` ON `customer` (`email`);");
    // gin/gist aren't MySQL index methods — ignored like an unset method.
    expect(
      dialect.createIndexDDL(
        { name: "email_idx", unique: false, columns: ["email"], method: "gin" },
        "customer",
      ),
    ).toBe("CREATE INDEX `email_idx` ON `customer` (`email`);");
  });

  it("bakes the column comment inline (no standalone COMMENT ON COLUMN)", () => {
    expect(
      dialect.columnDDL({
        name: "email",
        type: "varchar(320)",
        nullable: false,
        comment: "it's the primary contact",
      }),
    ).toBe("`email` varchar(320) NOT NULL COMMENT 'it''s the primary contact'");
    expect(dialect.columnCommentDDL).toBeUndefined();
  });
});

describe("createMySQLAdapter", () => {
  it("reports its kind as mysql", () => {
    const adapter = createMySQLAdapter({ execute: async () => {} });
    expect(adapter.kind).toBe("mysql");
  });
});

describe("planSqlDeployment with MySQL", () => {
  const dialect = createMySqlDialect();

  it("plans a DROP+ADD PRIMARY KEY (no constraint name needed) when the primary key column changes", () => {
    const deployed = shopModel();
    deployed.adapter = "mysql";
    const current = {
      ...deployed,
      entities: [
        {
          ...customerEntity(),
          attributes: customerEntity().attributes.map((a) => ({
            ...a,
            isPrimaryKey: a.name === "email",
          })),
        },
        deployed.entities[1]!,
      ],
    };
    const plan = planSqlDeployment(current, deployed, dialect);
    const step = plan.steps.find((s) => s.target === "customer" && s.action === "alter-attribute");
    expect(step?.sql).toBe("ALTER TABLE `customer` DROP PRIMARY KEY, ADD PRIMARY KEY (`email`);");
  });
});
