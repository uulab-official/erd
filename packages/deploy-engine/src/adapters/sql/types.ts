// SQL native schema shapes, shared across PostgreSQL/MySQL/SQLite dialects. See
// "공통 헬퍼: SqlDialect" in /docs/adapters.md.

export type ReferentialAction = "cascade" | "restrict" | "set-null" | "no-action";

export interface SqlColumnDef {
  name: string;
  type: string; // dialect-rendered, e.g. "varchar(255)", "integer"
  nullable: boolean;
  default?: string | number | boolean | null;
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

export interface SqlNativeSchema {
  tables: SqlTableDef[];
}
