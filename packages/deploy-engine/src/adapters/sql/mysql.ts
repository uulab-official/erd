import { createSqlDialect, type SqlDialect } from "./dialect.js";

export function createMySqlDialect(): SqlDialect {
  const quoteIdentifier = (name: string) => `\`${name.replace(/`/g, "``")}\``;

  const mapType: SqlDialect["mapType"] = (type, length, scale) => {
    switch (type) {
      case "string":
        return `varchar(${length ?? 255})`;
      case "uuid":
        // MySQL has no native UUID type; char(36) is the conventional stand-in.
        return "char(36)";
      case "integer":
        return "int";
      case "bigint":
        return "bigint";
      case "float":
        return scale !== undefined ? `decimal(${length ?? 18}, ${scale})` : "double";
      case "boolean":
        // MySQL's BOOLEAN is a BOOL alias for TINYINT(1) — spelled out for clarity.
        return "tinyint(1)";
      case "datetime":
        return "datetime";
      case "json":
        return "json";
      case "enum":
        return "text";
    }
  };

  const mapTypeBack: SqlDialect["mapTypeBack"] = (sqlType) => {
    const varchar = /^varchar\((\d+)\)$/.exec(sqlType);
    if (varchar) return { type: "string", length: Number(varchar[1]) };
    const decimal = /^decimal\((\d+),\s*(\d+)\)$/.exec(sqlType);
    if (decimal) return { type: "float", length: Number(decimal[1]), scale: Number(decimal[2]) };
    switch (sqlType) {
      case "char(36)":
        return { type: "uuid" };
      case "int":
        return { type: "integer" };
      case "bigint":
        return { type: "bigint" };
      case "double":
        return { type: "float" };
      case "tinyint(1)":
        return { type: "boolean" };
      case "datetime":
        return { type: "datetime" };
      case "json":
        return { type: "json" };
      default:
        return { type: "string" };
    }
  };

  return createSqlDialect({
    name: "mysql",
    supportsAlterForeignKey: true,
    quoteIdentifier,
    mapType,
    mapTypeBack,
    autoIncrementSuffix: " AUTO_INCREMENT",
  });
}
