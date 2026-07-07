// SQL native schema shapes, shared across PostgreSQL/MySQL/SQLite dialects. See
// "공통 헬퍼: SqlDialect" in /docs/adapters.md.

export type ReferentialAction = "cascade" | "restrict" | "set-null" | "no-action";

export interface SqlColumnDef {
  name: string;
  type: string; // dialect-rendered, e.g. "varchar(255)", "integer"
  nullable: boolean;
  default?: string | number | boolean | null;
  // Set only for a sole (non-composite) integer/bigint primary key column with no
  // explicit default — see toNativeSchema.ts. Each dialect renders this differently
  // (PostgreSQL: serial/bigserial type; MySQL: AUTO_INCREMENT suffix; SQLite: inline
  // "INTEGER PRIMARY KEY AUTOINCREMENT"), so the flag travels on the column rather than
  // being resolved to dialect-specific DDL text this early.
  autoIncrement?: boolean;
  // The linked EnumType's allowed values, set only when the dialect has no native enum
  // column type (see SqlDialect.enumColumnType) — columnDDL renders these as a
  // `CHECK (col IN (...))` clause. When the dialect *does* have a native enum type
  // (MySQL's `enum(...)`), the values are baked into `type` instead and this is omitted.
  checkValues?: string[];
}

export interface SqlIndexDef {
  name: string;
  unique: boolean;
  columns: string[];
}

export interface SqlForeignKeyDef {
  name: string;
  columns: string[];
  referencedTable: string;
  referencedColumns: string[];
  onDelete: ReferentialAction;
  onUpdate: ReferentialAction;
}

export interface SqlTableDef {
  name: string;
  columns: SqlColumnDef[];
  primaryKey: string[]; // column names, empty if none (flagged by validate())
  indexes: SqlIndexDef[];
  foreignKeys: SqlForeignKeyDef[];
}

export interface SqlSequenceDef {
  name: string;
  start: number;
  increment: number;
}

export interface SqlViewDef {
  name: string;
  sql: string;
}

export interface SqlNativeSchema {
  tables: SqlTableDef[];
  sequences: SqlSequenceDef[];
  views: SqlViewDef[];
}
