import { createSqlDialect, type SqlDialect } from "./dialect.js";

export function createSQLiteDialect(): SqlDialect {
  const quoteIdentifier = (name: string) => `"${name.replace(/"/g, '""')}"`;

  // SQLite is dynamically typed — these are type affinities, kept descriptive (rather
  // than collapsing everything to the bare affinity names) so round-tripping through
  // mapTypeBack can still recover length/scale where SQLite would otherwise discard them.
  const mapType: SqlDialect["mapType"] = (type, length, scale) => {
    switch (type) {
      case "string":
        return `varchar(${length ?? 255})`;
      case "uuid":
        return "text";
      case "integer":
        return "integer";
      case "bigint":
        return "integer";
      case "float":
        return scale !== undefined ? `numeric(${length ?? 18}, ${scale})` : "real";
      case "boolean":
        // SQLite has no boolean type; stored as 0/1 in an INTEGER column by convention.
        return "boolean";
      case "datetime":
        return "datetime";
      case "json":
        return "text";
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
      case "integer":
        return { type: "integer" };
      case "real":
        return { type: "float" };
      case "boolean":
        return { type: "boolean" };
      case "datetime":
        return { type: "datetime" };
      default:
        return { type: "string" };
    }
  };

  return createSqlDialect({
    name: "sqlite",
    supportsAlterForeignKey: false,
    quoteIdentifier,
    mapType,
    mapTypeBack,
  });
}
