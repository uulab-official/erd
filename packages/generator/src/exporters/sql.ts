import { createPostgresDialect, renderSql, toSqlNativeSchema } from "@modelforge/deploy-engine";
import type { Model } from "@modelforge/schema-engine";
import type { Exporter } from "@modelforge/sdk";

// PostgreSQL DDL export, reusing the same toNativeSchema/renderSql the PostgreSQLAdapter
// uses for Deploy Plan — the Exporter and the Adapter agree on one definition of "what
// this model looks like in SQL". See /docs/adapters.md.
export const sqlExporter: Exporter = {
  id: "export.sql",
  label: "SQL (PostgreSQL)",
  targetFormat: "sql",
  async export(model: Model) {
    const dialect = createPostgresDialect();
    return renderSql(toSqlNativeSchema(model, dialect), dialect);
  },
};
