import { describe, expect, it } from "vitest";
import { createPostgresDialect } from "./dialect.js";

describe("createPostgresDialect", () => {
  const dialect = createPostgresDialect();

  it("maps ColumnType to PostgreSQL types", () => {
    expect(dialect.mapType("string", 100)).toBe("varchar(100)");
    expect(dialect.mapType("string")).toBe("varchar(255)");
    expect(dialect.mapType("uuid")).toBe("uuid");
    expect(dialect.mapType("integer")).toBe("integer");
    expect(dialect.mapType("bigint")).toBe("bigint");
    expect(dialect.mapType("float")).toBe("double precision");
    expect(dialect.mapType("float", 10, 2)).toBe("numeric(10, 2)");
    expect(dialect.mapType("boolean")).toBe("boolean");
    expect(dialect.mapType("datetime")).toBe("timestamptz");
    expect(dialect.mapType("json")).toBe("jsonb");
    expect(dialect.mapType("enum")).toBe("text");
  });

  it("mapTypeBack inverts mapType for every ColumnType", () => {
    expect(dialect.mapTypeBack("varchar(100)")).toEqual({ type: "string", length: 100 });
    expect(dialect.mapTypeBack("uuid")).toEqual({ type: "uuid" });
    expect(dialect.mapTypeBack("integer")).toEqual({ type: "integer" });
    expect(dialect.mapTypeBack("bigint")).toEqual({ type: "bigint" });
    expect(dialect.mapTypeBack("double precision")).toEqual({ type: "float" });
    expect(dialect.mapTypeBack("numeric(10, 2)")).toEqual({ type: "float", length: 10, scale: 2 });
    expect(dialect.mapTypeBack("boolean")).toEqual({ type: "boolean" });
    expect(dialect.mapTypeBack("timestamptz")).toEqual({ type: "datetime" });
    expect(dialect.mapTypeBack("jsonb")).toEqual({ type: "json" });
  });

  it("quotes identifiers and escapes embedded quotes", () => {
    expect(dialect.quoteIdentifier("customer")).toBe('"customer"');
    expect(dialect.quoteIdentifier('weird"name')).toBe('"weird""name"');
  });

  it("renders a column definition with NOT NULL and DEFAULT", () => {
    expect(
      dialect.columnDDL({ name: "email", type: "varchar(320)", nullable: false, default: null }),
    ).toBe('"email" varchar(320) NOT NULL');
    expect(
      dialect.columnDDL({ name: "active", type: "boolean", nullable: true, default: true }),
    ).toBe('"active" boolean DEFAULT TRUE');
    expect(
      dialect.columnDDL({ name: "role", type: "varchar(20)", nullable: false, default: "user" }),
    ).toBe(`"role" varchar(20) NOT NULL DEFAULT 'user'`);
  });

  it("renders a CREATE TABLE statement including PRIMARY KEY", () => {
    const ddl = dialect.createTableDDL({
      name: "customer",
      columns: [
        { name: "id", type: "uuid", nullable: false, default: null },
        { name: "email", type: "varchar(320)", nullable: false, default: null },
      ],
      primaryKey: ["id"],
      indexes: [],
      foreignKeys: [],
    });
    expect(ddl).toContain('CREATE TABLE "customer"');
    expect(ddl).toContain('PRIMARY KEY ("id")');
  });

  it("renders CREATE INDEX and a foreign key ALTER TABLE", () => {
    expect(
      dialect.createIndexDDL({ name: "email_idx", unique: true, columns: ["email"] }, "customer"),
    ).toBe('CREATE UNIQUE INDEX "email_idx" ON "customer" ("email");');

    const fkDdl = dialect.foreignKeyDDL(
      {
        name: "fk_order_customer",
        columns: ["customer_id"],
        referencedTable: "customer",
        referencedColumns: ["id"],
        onDelete: "cascade",
        onUpdate: "no-action",
      },
      "order",
    );
    expect(fkDdl).toContain('ALTER TABLE "order" ADD CONSTRAINT "fk_order_customer"');
    expect(fkDdl).toContain("ON DELETE CASCADE");
    expect(fkDdl).toContain("ON UPDATE NO ACTION");
  });
});
