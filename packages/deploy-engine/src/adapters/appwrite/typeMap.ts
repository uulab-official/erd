import type { ColumnType } from "@modelforge/schema-engine";
import type { AppwriteAttributeType } from "./types.js";

// Appwrite has no native bigint/json/uuid/relationship-agnostic column types, so those
// fold onto the closest native type. See "초기 구현 대상" in /docs/adapters.md.
export function mapColumnTypeToAppwrite(type: ColumnType): AppwriteAttributeType {
  switch (type) {
    case "string":
    case "json":
    case "uuid":
      return "string";
    case "integer":
    case "bigint":
      return "integer";
    case "float":
      return "float";
    case "boolean":
      return "boolean";
    case "datetime":
      return "datetime";
    case "enum":
      return "enum";
  }
}

export function mapAppwriteToColumnType(type: AppwriteAttributeType): ColumnType {
  switch (type) {
    case "string":
      return "string";
    case "integer":
      return "integer";
    case "float":
      return "float";
    case "boolean":
      return "boolean";
    case "datetime":
      return "datetime";
    case "enum":
      return "enum";
  }
}

export function defaultSizeFor(type: ColumnType, length: number | undefined): number | undefined {
  if (type === "uuid") return length ?? 36;
  if (type === "string" || type === "json") return length ?? 255;
  return undefined;
}
