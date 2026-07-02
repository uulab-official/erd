import {
  createMySqlDialect,
  createPostgresDialect,
  createSQLiteDialect,
  renderSql,
  toSqlNativeSchema,
  type SqlDialect,
} from "@modelforge/deploy-engine";
import type { Model } from "@modelforge/schema-engine";
import type { Exporter } from "@modelforge/sdk";

// Reuses the same toNativeSchema/renderSql the SQL adapters use for Deploy Plan — the
// Exporter and the Adapter agree on one definition of "what this model looks like in
// SQL" per dialect. See /docs/adapters.md.
function createSqlExporter(id: string, label: string, dialect: SqlDialect): Exporter {
  return {
    id,
    label,
    targetFormat: "sql",
    async export(model: Model) {
      return renderSql(toSqlNativeSchema(model, dialect), dialect);
    },
  };
}

export const sqlExporter = createSqlExporter(
  "export.sql",
  "SQL (PostgreSQL)",
  createPostgresDialect(),
);
export const mysqlExporter = createSqlExporter(
  "export.sql.mysql",
  "SQL (MySQL)",
  createMySqlDialect(),
);
export const sqliteExporter = createSqlExporter(
  "export.sql.sqlite",
  "SQL (SQLite)",
  createSQLiteDialect(),
);
