import type { SqlDialect } from "./dialect.js";
import type { SqlNativeSchema } from "./types.js";

// Full DDL for a schema, in dependency order: all CREATE TABLEs first (so FK targets
// already exist), then indexes, then FK constraints via ALTER TABLE.
export function renderSql(schema: SqlNativeSchema, dialect: SqlDialect): string {
  const statements: string[] = [];

  for (const table of schema.tables) {
    statements.push(dialect.createTableDDL(table));
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

  return statements.join("\n\n");
}
