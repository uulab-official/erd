import type { SqlDialect } from "./dialect.js";
import type { SqlNativeSchema } from "./types.js";

// Full DDL for a schema, in dependency order: Sequences first (a column default could
// reference one, though nothing wires that up yet), then all CREATE TABLEs (so FK
// targets already exist), then indexes, then FK constraints via ALTER TABLE, then Views
// last (a view's SELECT can reference any table created above).
export function renderSql(schema: SqlNativeSchema, dialect: SqlDialect): string {
  const statements: string[] = [];

  // createSequenceDDL returns "" for a dialect with no native sequence support (MySQL/
  // SQLite) — filtered out rather than emitting an empty statement.
  for (const sequence of schema.sequences) {
    const ddl = dialect.createSequenceDDL(sequence);
    if (ddl) statements.push(ddl);
  }
  for (const table of schema.tables) {
    statements.push(dialect.createTableDDL(table));
  }
  // Only a dialect with standalone COMMENT ON COLUMN syntax (PostgreSQL) implements this
  // hook at all — MySQL bakes its comment inline into columnDDL above, and SQLite has no
  // column-comment feature, so both simply have no columnCommentDDL to call here.
  if (dialect.columnCommentDDL) {
    for (const table of schema.tables) {
      for (const column of table.columns) {
        if (column.comment) statements.push(dialect.columnCommentDDL(table.name, column));
      }
    }
  }
  for (const table of schema.tables) {
    for (const index of table.indexes) {
      statements.push(dialect.createIndexDDL(index, table.name));
    }
  }
  for (const table of schema.tables) {
    for (const fk of table.foreignKeys) {
      statements.push(dialect.foreignKeyDDL(fk, table.name));
    }
  }
  for (const view of schema.views) {
    statements.push(dialect.createViewDDL(view));
  }

  return statements.join("\n\n");
}
