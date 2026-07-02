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

export interface ModelStore {
  save(model: Model): Promise<void>;
  load(modelId: string): Promise<Model | null>;
  list(): Promise<ModelSummary[]>;
  remove(modelId: string): Promise<void>;
}

// The Model shape is a nested object tree, so it's persisted as a single JSON-encoded
// attribute rather than mapped onto fixed collection attributes. Document id == Model.id.
// `name` is duplicated onto its own attribute (rather than only living inside `data`) so
// list() can render a dashboard without JSON-parsing every model's full body.
interface ModelDocumentData {
  data: string;
  name: string;
}

const LIST_PAGE_SIZE = 100;

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
  };
}

export function newModelId(): string {
  return ID.unique();
}
