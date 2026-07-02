// CodeGenerator and Exporter implementations. See /docs/plugins.md.
import type { CodeGenerator, GeneratedFile } from "@modelforge/sdk";
import type { Model } from "@modelforge/schema-engine";

// Placeholder generator so the CodeGenerator contract has one concrete implementation
// until Prisma/TypeScript/OpenAPI generators land in later phases.
export const jsonSchemaExportGenerator: CodeGenerator = {
  id: "generator.json-schema",
  label: "JSON Schema",
  category: "language",
  async generate(model: Model): Promise<GeneratedFile[]> {
    return [{ path: `${model.name}.schema.json`, content: JSON.stringify(model, null, 2) }];
  },
};

export * from "./exporters/svg.js";
export * from "./exporters/markdown.js";
export * from "./exporters/json.js";
export * from "./exporters/sql.js";
