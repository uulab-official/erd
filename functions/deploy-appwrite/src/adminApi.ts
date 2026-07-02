import { Databases, DatabasesIndexType, RelationMutate, RelationshipType } from "node-appwrite";
import type { Client } from "node-appwrite";
import type {
  AppwriteAnyAttributeDef,
  AppwriteAttributeDef,
  AppwriteCollectionDef,
  AppwriteIndexDef,
  AppwriteRelationshipAttributeDef,
  ReferentialAction,
} from "./types.js";
import { isRelationshipAttribute } from "./types.js";

function mapRelationType(type: AppwriteRelationshipAttributeDef["relationType"]): RelationshipType {
  switch (type) {
    case "oneToOne":
      return RelationshipType.OneToOne;
    case "oneToMany":
      return RelationshipType.OneToMany;
    case "manyToOne":
      return RelationshipType.ManyToOne;
    case "manyToMany":
      return RelationshipType.ManyToMany;
  }
}

function mapOnDelete(action: ReferentialAction): RelationMutate {
  switch (action) {
    case "cascade":
      return RelationMutate.Cascade;
    case "set-null":
      return RelationMutate.SetNull;
    default:
      return RelationMutate.Restrict;
  }
}

function mapIndexType(type: AppwriteIndexDef["type"]): DatabasesIndexType {
  switch (type) {
    case "unique":
      return DatabasesIndexType.Unique;
    case "fulltext":
      return DatabasesIndexType.Fulltext;
    default:
      return DatabasesIndexType.Key;
  }
}

// Every primitive Appwrite Databases call this Function can make, one per concept in
// AppwriteNativeSchema (packages/deploy-engine/src/adapters/appwrite/types.ts). main.ts
// sequences these calls so a relationship's related collection always exists first —
// Appwrite itself has no notion of "create these two collections and link them
// atomically", so ordering is this Function's job, not the Databases API's.
export interface AdminApi {
  createCollectionShell(collection: Pick<AppwriteCollectionDef, "id" | "name">): Promise<void>;
  createPlainAttribute(collectionId: string, attr: AppwriteAttributeDef): Promise<void>;
  createRelationshipAttribute(
    collectionId: string,
    attr: AppwriteRelationshipAttributeDef,
  ): Promise<void>;
  alterAttribute(collectionId: string, attr: AppwriteAnyAttributeDef): Promise<void>;
  deleteAttribute(collectionId: string, key: string): Promise<void>;
  createIndex(collectionId: string, index: AppwriteIndexDef): Promise<void>;
  deleteIndex(collectionId: string, key: string): Promise<void>;
  deleteCollection(collectionId: string): Promise<void>;
}

export function createAttributeOrRelationship(
  api: AdminApi,
  collectionId: string,
  attr: AppwriteAnyAttributeDef,
): Promise<void> {
  return isRelationshipAttribute(attr)
    ? api.createRelationshipAttribute(collectionId, attr)
    : api.createPlainAttribute(collectionId, attr);
}

export function createAdminApi(client: Client, databaseId: string): AdminApi {
  const databases = new Databases(client);

  return {
    async createCollectionShell(collection) {
      await databases.createCollection({
        databaseId,
        collectionId: collection.id,
        name: collection.name,
      });
    },

    async createPlainAttribute(collectionId, attr) {
      const xdefault = attr.default ?? undefined;
      switch (attr.type) {
        case "string":
          await databases.createStringAttribute({
            databaseId,
            collectionId,
            key: attr.key,
            size: attr.size ?? 255,
            required: attr.required,
            xdefault: typeof xdefault === "string" ? xdefault : undefined,
            array: attr.array,
          });
          return;
        case "integer":
          await databases.createIntegerAttribute({
            databaseId,
            collectionId,
            key: attr.key,
            required: attr.required,
            xdefault: typeof xdefault === "number" ? xdefault : undefined,
            array: attr.array,
          });
          return;
        case "float":
          await databases.createFloatAttribute({
            databaseId,
            collectionId,
            key: attr.key,
            required: attr.required,
            xdefault: typeof xdefault === "number" ? xdefault : undefined,
            array: attr.array,
          });
          return;
        case "boolean":
          await databases.createBooleanAttribute({
            databaseId,
            collectionId,
            key: attr.key,
            required: attr.required,
            xdefault: typeof xdefault === "boolean" ? xdefault : undefined,
            array: attr.array,
          });
          return;
        case "datetime":
          await databases.createDatetimeAttribute({
            databaseId,
            collectionId,
            key: attr.key,
            required: attr.required,
            xdefault: typeof xdefault === "string" ? xdefault : undefined,
            array: attr.array,
          });
          return;
        case "enum":
          await databases.createEnumAttribute({
            databaseId,
            collectionId,
            key: attr.key,
            elements: attr.elements ?? [],
            required: attr.required,
            xdefault: typeof xdefault === "string" ? xdefault : undefined,
            array: attr.array,
          });
          return;
      }
    },

    async createRelationshipAttribute(collectionId, attr) {
      await databases.createRelationshipAttribute({
        databaseId,
        collectionId,
        relatedCollectionId: attr.relatedCollection,
        type: mapRelationType(attr.relationType),
        twoWay: attr.twoWay,
        key: attr.key,
        onDelete: mapOnDelete(attr.onDelete),
      });
    },

    async alterAttribute(collectionId, attr) {
      if (isRelationshipAttribute(attr)) {
        await databases.updateRelationshipAttribute({
          databaseId,
          collectionId,
          key: attr.key,
          onDelete: mapOnDelete(attr.onDelete),
        });
        return;
      }
      const xdefault = attr.default ?? undefined;
      switch (attr.type) {
        case "string":
          await databases.updateStringAttribute({
            databaseId,
            collectionId,
            key: attr.key,
            required: attr.required,
            xdefault: typeof xdefault === "string" ? xdefault : undefined,
            size: attr.size,
          });
          return;
        case "integer":
          await databases.updateIntegerAttribute({
            databaseId,
            collectionId,
            key: attr.key,
            required: attr.required,
            xdefault: typeof xdefault === "number" ? xdefault : undefined,
          });
          return;
        case "float":
          await databases.updateFloatAttribute({
            databaseId,
            collectionId,
            key: attr.key,
            required: attr.required,
            xdefault: typeof xdefault === "number" ? xdefault : undefined,
          });
          return;
        case "boolean":
          await databases.updateBooleanAttribute({
            databaseId,
            collectionId,
            key: attr.key,
            required: attr.required,
            xdefault: typeof xdefault === "boolean" ? xdefault : undefined,
          });
          return;
        case "datetime":
          await databases.updateDatetimeAttribute({
            databaseId,
            collectionId,
            key: attr.key,
            required: attr.required,
            xdefault: typeof xdefault === "string" ? xdefault : undefined,
          });
          return;
        case "enum":
          await databases.updateEnumAttribute({
            databaseId,
            collectionId,
            key: attr.key,
            elements: attr.elements ?? [],
            required: attr.required,
            xdefault: typeof xdefault === "string" ? xdefault : undefined,
          });
          return;
      }
    },

    async deleteAttribute(collectionId, key) {
      await databases.deleteAttribute({ databaseId, collectionId, key });
    },

    async createIndex(collectionId, index) {
      await databases.createIndex({
        databaseId,
        collectionId,
        key: index.key,
        type: mapIndexType(index.type),
        attributes: index.attributes,
      });
    },

    async deleteIndex(collectionId, key) {
      await databases.deleteIndex({ databaseId, collectionId, key });
    },

    async deleteCollection(collectionId) {
      await databases.deleteCollection({ databaseId, collectionId });
    },
  };
}
