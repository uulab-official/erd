import { layeredLayoutEngine } from "@modelforge/layout-engine";
import { dbmlImporter, mermaidImporter } from "@modelforge/parser";
import type { Model } from "@modelforge/schema-engine";
import type { Importer } from "@modelforge/sdk";

const IMPORTERS_BY_EXTENSION: Record<string, Importer> = {
  dbml: dbmlImporter,
  mmd: mermaidImporter,
  mermaid: mermaidImporter,
};

export const TEXT_IMPORT_EXTENSIONS = Object.keys(IMPORTERS_BY_EXTENSION);

export function textImporterFor(fileName: string): Importer | undefined {
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  return IMPORTERS_BY_EXTENSION[extension];
}

// Parses a DBML/Mermaid file into a Model and runs the layered auto-layout over it —
// text formats carry no canvas coordinates, so without this every imported entity
// would land stacked at (0,0).
export async function importTextFile(file: File): Promise<Model> {
  const importer = textImporterFor(file.name);
  if (!importer) {
    throw new Error(`No importer for "${file.name}" — supported: .dbml, .mmd, .mermaid`);
  }
  const parsed = await importer.parse(await file.text());
  const positions = await layeredLayoutEngine.layout(parsed);
  return {
    ...parsed,
    entities: parsed.entities.map((entity) => ({
      ...entity,
      ui: positions[entity.id] ?? entity.ui,
    })),
  };
}
