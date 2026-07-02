import { AppwriteException, Databases, ID, Query, type Client } from "appwrite";
import type { Model } from "@modelforge/schema-engine";
import type { AppwriteConfig } from "./client.js";

// Lightweight metadata for the dashboard's model list — deliberately excludes the full
// nested `data` body so listing doesn't pull down every model's entire entity/relationship
// tree just to render a list of names.
export interface ModelSummary {
  id: string;
  name: string;
  updatedAt: string;
}

// A saved snapshot of a Model at a point in time (erwin's "Baseline" / erdcloud's version
// history) — restore replaces the current Model with `snapshot` wholesale; compare/diff
// reuses @modelforge/diff-engine's diffModels(snapshot, currentModel) same as the existing
// "last saved vs current" Diff tab.
export interface ModelVersion {
  id: string;
  label: string;
  createdAt: string;
  snapshot: Model;
}

export type VersionSummary = Omit<ModelVersion, "snapshot">;

export interface ModelStore {
  save(model: Model): Promise<void>;
  load(modelId: string): Promise<Model | null>;
  list(): Promise<ModelSummary[]>;
  remove(modelId: string): Promise<void>;
  saveVersion(modelId: string, version: ModelVersion): Promise<void>;
  listVersions(modelId: string): Promise<VersionSummary[]>;
  getVersion(modelId: string, versionId: string): Promise<Model | null>;
  deleteVersion(modelId: string, versionId: string): Promise<void>;
}

// The Model shape is a nested object tree, so it's persisted as a single JSON-encoded
// attribute rather than mapped onto fixed collection attributes. Document id == Model.id.
// `name` is duplicated onto its own attribute (rather than only living inside `data`) so
// list() can render a dashboard without JSON-parsing every model's full body. `versions` —
// a JSON-encoded ModelVersion[] — lives on the same document rather than a separate
// collection/table, so versioning needs no additional Appwrite schema beyond this one
// optional attribute (missing entirely on older rows, treated as "no versions saved yet").
interface ModelDocumentData {
  data: string;
  name: string;
  versions?: string;
}

const LIST_PAGE_SIZE = 100;

function parseVersions(raw: string | undefined): ModelVersion[] {
  if (!raw) return [];
  try {
    return JSON.parse(raw) as ModelVersion[];
  } catch {
    return [];
  }
}

export function createAppwriteModelStore(
  client: Client,
  config: Pick<AppwriteConfig, "databaseId" | "modelsTableId">,
): ModelStore {
  const databases = new Databases(client);

  return {
    async save(model) {
      const data: ModelDocumentData = { data: JSON.stringify(model), name: model.name };
      try {
        await databases.updateDocument(config.databaseId, config.modelsTableId, model.id, data);
      } catch (error) {
        if (error instanceof AppwriteException && error.code === 404) {
          await databases.createDocument(config.databaseId, config.modelsTableId, model.id, data);
          return;
        }
        throw error;
      }
    },

    async load(modelId) {
      try {
        const document = await databases.getDocument(
          config.databaseId,
          config.modelsTableId,
          modelId,
        );
        return JSON.parse((document as unknown as ModelDocumentData).data) as Model;
      } catch (error) {
        if (error instanceof AppwriteException && error.code === 404) return null;
        throw error;
      }
    },

    async list() {
      const response = await databases.listDocuments(config.databaseId, config.modelsTableId, [
        Query.orderDesc("$updatedAt"),
        Query.limit(LIST_PAGE_SIZE),
      ]);
      return response.documents.map((document) => {
        const doc = document as unknown as ModelDocumentData & { $id: string; $updatedAt: string };
        // Older rows saved before `name` became its own attribute only have `data` — fall
        // back to parsing it rather than showing a blank/undefined name.
        const name = doc.name ?? (JSON.parse(doc.data) as Model).name;
        return { id: doc.$id, name, updatedAt: doc.$updatedAt };
      });
    },

    async remove(modelId) {
      try {
        await databases.deleteDocument(config.databaseId, config.modelsTableId, modelId);
      } catch (error) {
        if (error instanceof AppwriteException && error.code === 404) return;
        throw error;
      }
    },

    async saveVersion(modelId, version) {
      const document = await databases.getDocument(
        config.databaseId,
        config.modelsTableId,
        modelId,
      );
      const versions = parseVersions((document as unknown as ModelDocumentData).versions);
      versions.push(version);
      await databases.updateDocument(config.databaseId, config.modelsTableId, modelId, {
        versions: JSON.stringify(versions),
      });
    },

    async listVersions(modelId) {
      const document = await databases.getDocument(
        config.databaseId,
        config.modelsTableId,
        modelId,
      );
      return parseVersions((document as unknown as ModelDocumentData).versions).map(
        ({ id, label, createdAt }) => ({ id, label, createdAt }),
      );
    },

    async getVersion(modelId, versionId) {
      const document = await databases.getDocument(
        config.databaseId,
        config.modelsTableId,
        modelId,
      );
      const versions = parseVersions((document as unknown as ModelDocumentData).versions);
      return versions.find((v) => v.id === versionId)?.snapshot ?? null;
    },

    async deleteVersion(modelId, versionId) {
      const document = await databases.getDocument(
        config.databaseId,
        config.modelsTableId,
        modelId,
      );
      const versions = parseVersions((document as unknown as ModelDocumentData).versions).filter(
        (v) => v.id !== versionId,
      );
      await databases.updateDocument(config.databaseId, config.modelsTableId, modelId, {
        versions: JSON.stringify(versions),
      });
    },
  };
}

export function newModelId(): string {
  return ID.unique();
}
