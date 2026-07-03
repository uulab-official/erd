// Text-format Importers (DBML/Mermaid/SQL) that don't map to a deployable Adapter. See /docs/plugins.md.
import type { Model } from "@modelforge/schema-engine";
import type { Importer } from "@modelforge/sdk";
import { parseDbml } from "./dbml.js";

export { parseDbml } from "./dbml.js";

async function inputToText(input: string | Blob): Promise<string> {
  return typeof input === "string" ? input : input.text();
}

export const dbmlImporter: Importer = {
  id: "import.dbml",
  label: "DBML",
  sourceFormat: "dbml",
  async parse(input) {
    return parseDbml(await inputToText(input));
  },
};

export const mermaidImporter: Importer = {
  id: "import.mermaid",
  label: "Mermaid erDiagram",
  sourceFormat: "mermaid",
  async parse(input) {
    return parseMermaidErDiagram(await inputToText(input));
  },
};

// Placeholder Mermaid erDiagram parser: recognizes `Entity1 ||--o{ Entity2 : label` lines
// and produces empty-attribute entities/relationships. Full attribute parsing lands later.
export function parseMermaidErDiagram(source: string): Model {
  const entities = new Map<string, Model["entities"][number]>();
  const relationships: Model["relationships"] = [];

  const lineRe = /^\s*(\w+)\s+([|}][|o]--[|o][|{])\s+(\w+)\s*:\s*(.+)$/;
  for (const line of source.split("\n")) {
    const match = lineRe.exec(line);
    if (!match) continue;
    const [, left, , right, label] = match;
    for (const name of [left, right]) {
      if (!name || entities.has(name)) continue;
      entities.set(name, {
        id: name,
        logicalName: name,
        physicalName: name,
        tags: [],
        attributes: [],
        indexes: [],
        ui: { x: 0, y: 0 },
      });
    }
    if (left && right) {
      relationships.push({
        id: `${left}-${right}`,
        name: label,
        sourceEntityId: left,
        targetEntityId: right,
        cardinality: "one-to-many",
        kind: "non-identifying",
        optionality: "optional",
        sourceAttributeIds: [],
        targetAttributeIds: [],
      });
    }
  }

  return {
    id: "imported",
    name: "Imported",
    adapter: "postgresql",
    entities: [...entities.values()],
    relationships,
    views: [],
    sequences: [],
    enums: [],
  };
}
