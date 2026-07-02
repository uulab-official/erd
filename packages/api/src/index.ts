// Appwrite SDK wrapper for Auth and Project/Model persistence/Realtime.
// See /docs/schema-engine.md (Project/Model containers) — the client never talks to
// Appwrite directly; everything goes through this package.
import type { Model } from "@modelforge/schema-engine";
import type { ModelStore, ModelVersion } from "./modelStore.js";

export * from "./client.js";
export * from "./auth.js";
export * from "./modelStore.js";
export * from "./functions.js";
export type { Models } from "appwrite";

// In-memory store used for local dev/tests without an Appwrite project configured.
export function createInMemoryModelStore(): ModelStore {
  const models = new Map<string, Model>();
  const updatedAt = new Map<string, string>();
  // wall-clock timestamps only have millisecond resolution, which two saves in the same
  // tick (e.g. back-to-back in a test) can tie on — a separate monotonic counter keeps
  // list() ordering deterministic (most-recently-saved first) regardless of clock ties.
  let sequence = 0;
  const savedAtSequence = new Map<string, number>();
  const versions = new Map<string, ModelVersion[]>();

  return {
    async save(model) {
      models.set(model.id, model);
      updatedAt.set(model.id, new Date().toISOString());
      savedAtSequence.set(model.id, ++sequence);
    },
    async load(modelId) {
      return models.get(modelId) ?? null;
    },
    async list() {
      return [...models.values()]
        .map((model) => ({
          id: model.id,
          name: model.name,
          updatedAt: updatedAt.get(model.id) ?? new Date(0).toISOString(),
        }))
        .sort((a, b) => (savedAtSequence.get(b.id) ?? 0) - (savedAtSequence.get(a.id) ?? 0));
    },
    async remove(modelId) {
      models.delete(modelId);
      updatedAt.delete(modelId);
      savedAtSequence.delete(modelId);
      versions.delete(modelId);
    },
    async saveVersion(modelId, version) {
      const existing = versions.get(modelId) ?? [];
      versions.set(modelId, [...existing, version]);
    },
    async listVersions(modelId) {
      return (versions.get(modelId) ?? []).map(({ id, label, createdAt }) => ({
        id,
        label,
        createdAt,
      }));
    },
    async getVersion(modelId, versionId) {
      return (versions.get(modelId) ?? []).find((v) => v.id === versionId)?.snapshot ?? null;
    },
    async deleteVersion(modelId, versionId) {
      versions.set(
        modelId,
        (versions.get(modelId) ?? []).filter((v) => v.id !== versionId),
      );
    },
  };
}
