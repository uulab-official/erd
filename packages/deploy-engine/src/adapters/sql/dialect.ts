import type { ColumnType } from "@modelforge/schema-engine";
import type { SqlColumnDef, SqlForeignKeyDef, SqlIndexDef, SqlTableDef } from "./types.js";

export interface ReverseMappedType {
  type: ColumnType;
  length?: number;
  scale?: number;
}

// Shared contract each RDBMS dialect implements — PostgreSQLAdapter/MySQLAdapter/
// SQLiteAdapter are thin wrappers around one of these rather than each reimplementing
// DatabaseAdapter from scratch. See "공통 헬퍼: SqlDialect" in /docs/adapters.md.
export interface SqlDialect {
  readonly name: string;
  quoteIdentifier(name: string): string;
  mapType(type: ColumnType, length?: number, scale?: number): string;
  // Structural introspection (e.g. via `pg`) would build a SqlNativeSchema directly from
  // information_schema types, not by parsing rendered DDL text — this is that reverse
  // half of mapType, used by fromNativeSchema.
  mapTypeBack(sqlType: string): ReverseMappedType;
  columnDDL(column: SqlColumnDef): string;
  createTableDDL(table: SqlTableDef): string;
  createIndexDDL(index: SqlIndexDef, tableName: string): string;
  foreignKeyDDL(fk: SqlForeignKeyDef, ownerTableName: string): string;
}

function formatDefault(value: SqlColumnDef["default"]): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return ` DEFAULT '${value.replace(/'/g, "''")}'`;
  if (typeof value === "boolean") return ` DEFAULT ${value ? "TRUE" : "FALSE"}`;
  return ` DEFAULT ${value}`;
}

function referentialActionSql(action: SqlForeignKeyDef["onDelete"]): string {
  switch (action) {
    case "cascade":
      return "CASCADE";
    case "set-null":
      return "SET NULL";
    case "no-action":
      return "NO ACTION";
    default:
      return "RESTRICT";
  }
}

export function createPostgresDialect(): SqlDialect {
  const quoteIdentifier = (name: string) => `"${name.replace(/"/g, '""')}"`;

  const mapType: SqlDialect["mapType"] = (type, length, scale) => {
    switch (type) {
      case "string":
        return `varchar(${length ?? 255})`;
      case "uuid":
        return "uuid";
      case "integer":
        return "integer";
      case "bigint":
        return "bigint";
      case "float":
        return scale !== undefined ? `numeric(${length ?? 18}, ${scale})` : "double precision";
      case "boolean":
        return "boolean";
      case "datetime":
        return "timestamptz";
      case "json":
        return "jsonb";
      case "enum":
        return "text";
    }
  };

  const mapTypeBack: SqlDialect["mapTypeBack"] = (sqlType) => {
    const varchar = /^varchar\((\d+)\)$/.exec(sqlType);
    if (varchar) return { type: "string", length: Number(varchar[1]) };
    const numeric = /^numeric\((\d+),\s*(\d+)\)$/.exec(sqlType);
    if (numeric) return { type: "float", length: Number(numeric[1]), scale: Number(numeric[2]) };
    switch (sqlType) {
      case "uuid":
        return { type: "uuid" };
      case "integer":
        return { type: "integer" };
      case "bigint":
        return { type: "bigint" };
      case "double precision":
        return { type: "float" };
      case "boolean":
        return { type: "boolean" };
      case "timestamptz":
        return { type: "datetime" };
      case "jsonb":
        return { type: "json" };
      default:
        return { type: "string" };
    }
  };

  const columnDDL: SqlDialect["columnDDL"] = (column) =>
    `${quoteIdentifier(column.name)} ${column.type}${column.nullable ? "" : " NOT NULL"}${formatDefault(column.default)}`;

  const createTableDDL: SqlDialect["createTableDDL"] = (table) => {
    const lines = table.columns.map(columnDDL);
    if (table.primaryKey.length > 0) {
      lines.push(`PRIMARY KEY (${table.primaryKey.map(quoteIdentifier).join(", ")})`);
    }
    return `CREATE TABLE ${quoteIdentifier(table.name)} (\n  ${lines.join(",\n  ")}\n);`;
  };

  const createIndexDDL: SqlDialect["createIndexDDL"] = (index, tableName) =>
    `CREATE ${index.unique ? "UNIQUE " : ""}INDEX ${quoteIdentifier(index.name)} ON ${quoteIdentifier(tableName)} (${index.columns.map(quoteIdentifier).join(", ")});`;

  const foreignKeyDDL: SqlDialect["foreignKeyDDL"] = (fk, ownerTableName) =>
    `ALTER TABLE ${quoteIdentifier(ownerTableName)} ADD CONSTRAINT ${quoteIdentifier(fk.name)} FOREIGN KEY (${fk.columns.map(quoteIdentifier).join(", ")}) REFERENCES ${quoteIdentifier(fk.referencedTable)} (${fk.referencedColumns.map(quoteIdentifier).join(", ")}) ON DELETE ${referentialActionSql(fk.onDelete)} ON UPDATE ${referentialActionSql(fk.onUpdate)};`;

  return {
    name: "postgresql",
    quoteIdentifier,
    mapType,
    mapTypeBack,
    columnDDL,
    createTableDDL,
    createIndexDDL,
    foreignKeyDDL,
  };
}
