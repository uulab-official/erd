// Plugin contracts (Exporter/Importer/CodeGenerator/AIProvider/LayoutEngine). See /docs/plugins.md.
import type { Model } from "@modelforge/schema-engine";
import type { Operation } from "./operations.js";

export interface Exporter {
  id: string;
  label: string;
  targetFormat: "png" | "svg" | "pdf" | "markdown" | "excel" | "json" | "sql" | "mermaid";
  export(model: Model, options?: unknown): Promise<Blob | string>;
}

export interface Importer {
  id: string;
  label: string;
  sourceFormat:
    | "sql"
    | "dbml"
    | "mermaid"
    | "prisma"
    | "appwrite"
    | "postgresql"
    | "mysql"
    | "mssql"
    | "oracle";
  parse(input: string | Blob): Promise<Model>;
}

export interface GeneratedFile {
  path: string;
  content: string;
}

export interface CodeGenerator {
  id: string;
  label: string;
  category: "orm" | "language" | "api-doc";
  generate(model: Model, options?: unknown): Promise<GeneratedFile[]>;
}

export interface AIProvider {
  id: string;
  label: string;
  generateModel(prompt: string, context?: { existingModel?: Model }): Promise<Operation[]>;
  reviseModel(prompt: string, model: Model): Promise<Operation[]>;
}

export interface LayoutEngine {
  id: string;
  label: string;
  algorithm: "tree" | "grid" | "layer" | "force" | "orthogonal";
  layout(model: Model): Promise<Record<string, { x: number; y: number }>>;
}

export type Plugin =
  | { type: "exporter"; impl: Exporter }
  | { type: "importer"; impl: Importer }
  | { type: "generator"; impl: CodeGenerator }
  | { type: "ai-provider"; impl: AIProvider }
  | { type: "layout-engine"; impl: LayoutEngine };

export interface PluginRegistry {
  exporters: Map<string, Exporter>;
  importers: Map<string, Importer>;
  generators: Map<string, CodeGenerator>;
  aiProviders: Map<string, AIProvider>;
  layoutEngines: Map<string, LayoutEngine>;
  register(plugin: Plugin): void;
}

export function createPluginRegistry(): PluginRegistry {
  const registry: PluginRegistry = {
    exporters: new Map(),
    importers: new Map(),
    generators: new Map(),
    aiProviders: new Map(),
    layoutEngines: new Map(),
    register(plugin) {
      switch (plugin.type) {
        case "exporter":
          registry.exporters.set(plugin.impl.id, plugin.impl);
          break;
        case "importer":
          registry.importers.set(plugin.impl.id, plugin.impl);
          break;
        case "generator":
          registry.generators.set(plugin.impl.id, plugin.impl);
          break;
        case "ai-provider":
          registry.aiProviders.set(plugin.impl.id, plugin.impl);
          break;
        case "layout-engine":
          registry.layoutEngines.set(plugin.impl.id, plugin.impl);
          break;
      }
    },
  };
  return registry;
}
