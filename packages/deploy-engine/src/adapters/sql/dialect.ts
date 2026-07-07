import type { ColumnType } from "@modelforge/schema-engine";
import type {
  SqlColumnDef,
  SqlForeignKeyDef,
  SqlIndexDef,
  SqlSequenceDef,
  SqlTableDef,
  SqlViewDef,
} from "./types.js";

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
  // SQLite has no ALTER TABLE ... ADD CONSTRAINT — foreign keys can only be declared
  // inline inside CREATE TABLE. createSqlDialect() uses this to decide whether
  // createTableDDL should inline FK clauses and whether foreignKeyDDL emits anything.
  readonly supportsAlterForeignKey: boolean;
  quoteIdentifier(name: string): string;
  mapType(type: ColumnType, length?: number, scale?: number): string;
  // Structural introspection (e.g. via `pg`) would build a SqlNativeSchema directly from
  // information_schema types, not by parsing rendered DDL text — this is that reverse
  // half of mapType, used by fromNativeSchema.
  mapTypeBack(sqlType: string): ReverseMappedType;
  // Only MySQL implements this (its native `enum(...)` column type) — toNativeSchema
  // falls back to the dialect's plain enum->text mapping plus a CHECK constraint
  // (SqlColumnDef.checkValues) when this is absent.
  enumColumnType?(values: string[]): string;
  columnDDL(column: SqlColumnDef): string;
  createTableDDL(table: SqlTableDef): string;
  createIndexDDL(index: SqlIndexDef, tableName: string): string;
  // Returns "" for a dialect where foreign keys are inline-only (see
  // supportsAlterForeignKey) — the constraint is already part of createTableDDL.
  foreignKeyDDL(fk: SqlForeignKeyDef, ownerTableName: string): string;
  createViewDDL(view: SqlViewDef): string;
  dropViewDDL(viewName: string): string;
  // Standalone named sequence objects are a first-class PostgreSQL feature (CREATE
  // SEQUENCE) but have no standard-MySQL/SQLite equivalent (unlike the AUTO_INCREMENT/
  // AUTOINCREMENT column-level sugar already handled by autoIncrementType/Suffix above,
  // which is a different concept — a sequence can be named, shared, and have a custom
  // start/increment independent of any one column). createSequenceDDL/dropSequenceDDL
  // return "" when supportsSequences is false — callers check that flag first rather than
  // guessing at nonexistent syntax, the same "don't guess, warn" policy used for SQLite's
  // FK-ALTER limitation.
  readonly supportsSequences: boolean;
  createSequenceDDL(sequence: SqlSequenceDef): string;
  dropSequenceDDL(sequenceName: string): string;
  // Standalone `COMMENT ON COLUMN` statement (PostgreSQL) — MySQL instead bakes the
  // comment inline into columnDDL itself (see SqlDialectOptions.columnCommentSuffix),
  // and SQLite has no column-comment feature at all, so both omit this hook entirely
  // rather than returning "" (there's nothing for a caller to conditionally skip).
  columnCommentDDL?(tableName: string, column: SqlColumnDef): string;
}

function formatDefault(value: SqlColumnDef["default"]): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return ` DEFAULT '${value.replace(/'/g, "''")}'`;
  if (typeof value === "boolean") return ` DEFAULT ${value ? "TRUE" : "FALSE"}`;
  return ` DEFAULT ${value}`;
}

function formatCheckClause(
  column: SqlColumnDef,
  quoteIdentifier: (name: string) => string,
): string {
  if (!column.checkValues || column.checkValues.length === 0) return "";
  const values = column.checkValues.map((v) => `'${v.replace(/'/g, "''")}'`).join(", ");
  return ` CHECK (${quoteIdentifier(column.name)} IN (${values}))`;
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

export interface SqlDialectOptions {
  name: string;
  supportsAlterForeignKey: boolean;
  quoteIdentifier(name: string): string;
  mapType: SqlDialect["mapType"];
  mapTypeBack: SqlDialect["mapTypeBack"];
  // PostgreSQL: swaps "integer"/"bigint" for "serial"/"bigserial" on an auto-increment
  // column instead of appending a suffix.
  autoIncrementType?(mappedType: string): string;
  // MySQL: appended to the column definition (" AUTO_INCREMENT").
  autoIncrementSuffix?: string;
  // SQLite: has no AUTO_INCREMENT/SERIAL — a sole integer PK column must instead be
  // declared "INTEGER PRIMARY KEY AUTOINCREMENT" inline, replacing both the plain
  // column line and the separate PRIMARY KEY (...) table constraint for that column.
  inlinePrimaryKeyOnAutoIncrement?: boolean;
  // MySQL: native `enum(...)` column type. Dialects without one (PostgreSQL/SQLite) omit
  // this and toNativeSchema falls back to a CHECK constraint instead.
  enumColumnType?(values: string[]): string;
  // Only PostgreSQL sets this — see SqlDialect.supportsSequences.
  supportsSequences?: boolean;
  // MySQL: appended to the column definition (" COMMENT 'text'").
  columnCommentSuffix?(comment: string): string;
  // PostgreSQL: standalone `COMMENT ON COLUMN` syntax is standard SQL and identical for
  // any dialect that has it, so a boolean flag is enough — createSqlDialect builds the
  // generic columnCommentDDL implementation itself, the same shape as supportsSequences.
  supportsColumnComments?: boolean;
}

// Generic implementation of columnDDL/createTableDDL/createIndexDDL/foreignKeyDDL shared
// across dialects — each dialect only supplies identifier quoting, type mapping, and
// whether/how it supports ALTER TABLE ... ADD CONSTRAINT for foreign keys and
// auto-increment primary keys.
export function createSqlDialect(options: SqlDialectOptions): SqlDialect {
  const {
    quoteIdentifier,
    supportsAlterForeignKey,
    autoIncrementType,
    autoIncrementSuffix,
    inlinePrimaryKeyOnAutoIncrement,
    enumColumnType,
    supportsSequences = false,
    columnCommentSuffix,
    supportsColumnComments = false,
  } = options;

  const columnDDL: SqlDialect["columnDDL"] = (column) => {
    const checkClause = formatCheckClause(column, quoteIdentifier);
    const commentSuffix =
      column.comment && columnCommentSuffix ? columnCommentSuffix(column.comment) : "";
    if (column.autoIncrement && inlinePrimaryKeyOnAutoIncrement) {
      // SQLite: type + PRIMARY KEY + AUTOINCREMENT all live on the column itself; the
      // caller (createTableDDL) omits this column from the separate PRIMARY KEY (...)
      // line so it isn't declared twice. SQLite has no comment feature at all, so
      // commentSuffix is always "" here regardless.
      return `${quoteIdentifier(column.name)} ${column.type} PRIMARY KEY AUTOINCREMENT${checkClause}`;
    }
    const type =
      column.autoIncrement && autoIncrementType ? autoIncrementType(column.type) : column.type;
    const suffix = column.autoIncrement && autoIncrementSuffix ? autoIncrementSuffix : "";
    return `${quoteIdentifier(column.name)} ${type}${column.nullable ? "" : " NOT NULL"}${formatDefault(column.default)}${suffix}${checkClause}${commentSuffix}`;
  };

  const inlineForeignKeyDDL = (fk: SqlForeignKeyDef): string =>
    `FOREIGN KEY (${fk.columns.map(quoteIdentifier).join(", ")}) REFERENCES ${quoteIdentifier(fk.referencedTable)} (${fk.referencedColumns.map(quoteIdentifier).join(", ")}) ON DELETE ${referentialActionSql(fk.onDelete)} ON UPDATE ${referentialActionSql(fk.onUpdate)}`;

  const createTableDDL: SqlDialect["createTableDDL"] = (table) => {
    const lines = table.columns.map(columnDDL);
    const inlinedPrimaryKeyColumn =
      inlinePrimaryKeyOnAutoIncrement && table.columns.find((c) => c.autoIncrement)?.name;
    const remainingPrimaryKey = inlinedPrimaryKeyColumn
      ? table.primaryKey.filter((name) => name !== inlinedPrimaryKeyColumn)
      : table.primaryKey;
    if (remainingPrimaryKey.length > 0) {
      lines.push(`PRIMARY KEY (${remainingPrimaryKey.map(quoteIdentifier).join(", ")})`);
    }
    if (!supportsAlterForeignKey) {
      for (const fk of table.foreignKeys) {
        lines.push(inlineForeignKeyDDL(fk));
      }
    }
    return `CREATE TABLE ${quoteIdentifier(table.name)} (\n  ${lines.join(",\n  ")}\n);`;
  };

  const createIndexDDL: SqlDialect["createIndexDDL"] = (index, tableName) =>
    `CREATE ${index.unique ? "UNIQUE " : ""}INDEX ${quoteIdentifier(index.name)} ON ${quoteIdentifier(tableName)} (${index.columns.map(quoteIdentifier).join(", ")});`;

  const foreignKeyDDL: SqlDialect["foreignKeyDDL"] = (fk, ownerTableName) =>
    supportsAlterForeignKey
      ? `ALTER TABLE ${quoteIdentifier(ownerTableName)} ADD CONSTRAINT ${quoteIdentifier(fk.name)} ${inlineForeignKeyDDL(fk)};`
      : "";

  // CREATE VIEW/DROP VIEW syntax is identical across PostgreSQL/MySQL/SQLite, so this is
  // shared rather than a per-dialect hook (unlike createSequenceDDL below).
  const createViewDDL: SqlDialect["createViewDDL"] = (view) =>
    `CREATE VIEW ${quoteIdentifier(view.name)} AS ${view.sql};`;
  const dropViewDDL: SqlDialect["dropViewDDL"] = (viewName) =>
    `DROP VIEW ${quoteIdentifier(viewName)};`;

  const createSequenceDDL: SqlDialect["createSequenceDDL"] = (sequence) =>
    supportsSequences
      ? `CREATE SEQUENCE ${quoteIdentifier(sequence.name)} START WITH ${sequence.start} INCREMENT BY ${sequence.increment};`
      : "";
  const dropSequenceDDL: SqlDialect["dropSequenceDDL"] = (sequenceName) =>
    supportsSequences ? `DROP SEQUENCE ${quoteIdentifier(sequenceName)};` : "";

  const columnCommentDDL: SqlDialect["columnCommentDDL"] = (tableName, column) =>
    `COMMENT ON COLUMN ${quoteIdentifier(tableName)}.${quoteIdentifier(column.name)} IS '${(column.comment ?? "").replace(/'/g, "''")}';`;

  return {
    name: options.name,
    supportsAlterForeignKey,
    supportsSequences,
    quoteIdentifier,
    mapType: options.mapType,
    mapTypeBack: options.mapTypeBack,
    ...(enumColumnType ? { enumColumnType } : {}),
    ...(supportsColumnComments ? { columnCommentDDL } : {}),
    columnDDL,
    createTableDDL,
    createIndexDDL,
    foreignKeyDDL,
    createViewDDL,
    dropViewDDL,
    createSequenceDDL,
    dropSequenceDDL,
  };
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
      // serial/bigserial are sugar for integer/bigint + an implicit sequence+default —
      // the auto-increment-ness itself is re-derived from isPrimaryKey+no-default when
      // this round-trips back through toNativeSchema, not carried as its own flag here.
      case "serial":
        return { type: "integer" };
      case "bigserial":
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

  return createSqlDialect({
    name: "postgresql",
    supportsAlterForeignKey: true,
    quoteIdentifier,
    mapType,
    mapTypeBack,
    // PostgreSQL has no AUTO_INCREMENT keyword — serial/bigserial are sugar for
    // integer/bigint plus an implicitly-created sequence and DEFAULT nextval(...).
    autoIncrementType: (mappedType) => (mappedType === "bigint" ? "bigserial" : "serial"),
    supportsSequences: true,
    supportsColumnComments: true,
  });
}
