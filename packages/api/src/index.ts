// Thin wrapper around the Appwrite SDK for Project/Model persistence and Realtime.
// See /docs/schema-engine.md (Project/Model containers) — the client never talks to Appwrite directly.
import type { Model } from "@modelforge/schema-engine";

export interface ModelStore {
  save(model: Model): Promise<void>;
  load(modelId: string): Promise<Model | null>;
}

// In-memory store used for local dev/tests until the AppwriteModelStore lands in Phase 1.
export function createInMemoryModelStore(): ModelStore {
  const models = new Map<string, Model>();
  return {
    async save(model) {
      models.set(model.id, model);
    },
    async load(modelId) {
      return models.get(modelId) ?? null;
    },
  };
}
