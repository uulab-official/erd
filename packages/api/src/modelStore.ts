import { AppwriteException, Databases, ID, type Client } from "appwrite";
import type { Model } from "@modelforge/schema-engine";
import type { AppwriteConfig } from "./client.js";

export interface ModelStore {
  save(model: Model): Promise<void>;
  load(modelId: string): Promise<Model | null>;
}

// The Model shape is a nested object tree, so it's persisted as a single JSON-encoded
// attribute rather than mapped onto fixed collection attributes. Document id == Model.id.
interface ModelDocumentData {
  data: string;
}

export function createAppwriteModelStore(
  client: Client,
  config: Pick<AppwriteConfig, "databaseId" | "modelsTableId">,
): ModelStore {
  const databases = new Databases(client);

  return {
    async save(model) {
      const data: ModelDocumentData = { data: JSON.stringify(model) };
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
  };
}

export function newModelId(): string {
  return ID.unique();
}
