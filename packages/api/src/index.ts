// Appwrite SDK wrapper for Auth and Project/Model persistence/Realtime.
// See /docs/schema-engine.md (Project/Model containers) — the client never talks to
// Appwrite directly; everything goes through this package.
import type { Model } from "@modelforge/schema-engine";
import type { ModelStore } from "./modelStore.js";

export * from "./client.js";
export * from "./auth.js";
export * from "./modelStore.js";
export * from "./functions.js";
export type { Models } from "appwrite";

// In-memory store used for local dev/tests without an Appwrite project configured.
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
