// CodeGenerator and Exporter implementations. See /docs/plugins.md.
import type { CodeGenerator, GeneratedFile } from "@modelforge/sdk";
import type { Model } from "@modelforge/schema-engine";

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
export * from "./exporters/mermaid.js";
export * from "./generators/prisma.js";
export * from "./generators/graphql.js";
export * from "./generators/openapi.js";
