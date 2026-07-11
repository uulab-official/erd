import {
  AttributeStatus,
  Databases,
  DatabasesIndexType,
  IndexStatus,
  RelationMutate,
  RelationshipType,
} from "node-appwrite";
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

const DEFAULT_POLL_INTERVAL_MS = 500;
const DEFAULT_POLL_TIMEOUT_MS = 30_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface PollOptions {
  pollIntervalMs?: number;
  timeoutMs?: number;
}

// Appwrite creates/alters attributes and indexes asynchronously — right after the
// createXAttribute/createIndex call resolves, the object is still in "processing" status
// and only becomes "available" some time later. A step that depends on it (an index over
// an attribute just created, a relationship attribute pointing at a related collection's
// attribute, or simply the *next* step in this same deploy plan) can fail with an
// "Attribute not available"-style error if it runs first. Polling here — rather than at
// each call site — means every AdminApi method's returned Promise only resolves once
// what it created/altered is actually usable, so applyPlan.ts's strictly sequential
// phase-by-phase execution (see its comment) is safe without knowing about this at all.
async function waitForAttributeAvailable(
  databases: Databases,
  databaseId: string,
  collectionId: string,
  key: string,
  {
    pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
    timeoutMs = DEFAULT_POLL_TIMEOUT_MS,
  }: PollOptions = {},
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const attr = await databases.getAttribute({ databaseId, collectionId, key });
    if (attr.status === AttributeStatus.Available) return;
    if (attr.status === AttributeStatus.Failed || attr.status === AttributeStatus.Stuck) {
      throw new Error(
        `Attribute "${collectionId}.${key}" failed to become available (status: ${attr.status}).`,
      );
    }
    if (Date.now() >= deadline) {
      throw new Error(
        `Timed out waiting for attribute "${collectionId}.${key}" to become available.`,
      );
    }
    await sleep(pollIntervalMs);
  }
}

async function waitForIndexAvailable(
  databases: Databases,
  databaseId: string,
  collectionId: string,
  key: string,
  {
    pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
    timeoutMs = DEFAULT_POLL_TIMEOUT_MS,
  }: PollOptions = {},
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const index = await databases.getIndex({ databaseId, collectionId, key });
    if (index.status === IndexStatus.Available) return;
    if (index.status === IndexStatus.Failed || index.status === IndexStatus.Stuck) {
      throw new Error(
        `Index "${collectionId}.${key}" failed to become available (status: ${index.status}).`,
      );
    }
    if (Date.now() >= deadline) {
      throw new Error(`Timed out waiting for index "${collectionId}.${key}" to become available.`);
    }
    await sleep(pollIntervalMs);
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

export function createAdminApi(
  client: Client,
  databaseId: string,
  pollOptions: PollOptions = {},
): AdminApi {
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
          break;
        case "integer":
          await databases.createIntegerAttribute({
            databaseId,
            collectionId,
            key: attr.key,
            required: attr.required,
            xdefault: typeof xdefault === "number" ? xdefault : undefined,
            array: attr.array,
          });
          break;
        case "float":
          await databases.createFloatAttribute({
            databaseId,
            collectionId,
            key: attr.key,
            required: attr.required,
            xdefault: typeof xdefault === "number" ? xdefault : undefined,
            array: attr.array,
          });
          break;
        case "boolean":
          await databases.createBooleanAttribute({
            databaseId,
            collectionId,
            key: attr.key,
            required: attr.required,
            xdefault: typeof xdefault === "boolean" ? xdefault : undefined,
            array: attr.array,
          });
          break;
        case "datetime":
          await databases.createDatetimeAttribute({
            databaseId,
            collectionId,
            key: attr.key,
            required: attr.required,
            xdefault: typeof xdefault === "string" ? xdefault : undefined,
            array: attr.array,
          });
          break;
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
          break;
      }
      await waitForAttributeAvailable(databases, databaseId, collectionId, attr.key, pollOptions);
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
      await waitForAttributeAvailable(databases, databaseId, collectionId, attr.key, pollOptions);
    },

    async alterAttribute(collectionId, attr) {
      if (isRelationshipAttribute(attr)) {
        await databases.updateRelationshipAttribute({
          databaseId,
          collectionId,
          key: attr.key,
          onDelete: mapOnDelete(attr.onDelete),
        });
        await waitForAttributeAvailable(databases, databaseId, collectionId, attr.key, pollOptions);
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
          break;
        case "integer":
          await databases.updateIntegerAttribute({
            databaseId,
            collectionId,
            key: attr.key,
            required: attr.required,
            xdefault: typeof xdefault === "number" ? xdefault : undefined,
          });
          break;
        case "float":
          await databases.updateFloatAttribute({
            databaseId,
            collectionId,
            key: attr.key,
            required: attr.required,
            xdefault: typeof xdefault === "number" ? xdefault : undefined,
          });
          break;
        case "boolean":
          await databases.updateBooleanAttribute({
            databaseId,
            collectionId,
            key: attr.key,
            required: attr.required,
            xdefault: typeof xdefault === "boolean" ? xdefault : undefined,
          });
          break;
        case "datetime":
          await databases.updateDatetimeAttribute({
            databaseId,
            collectionId,
            key: attr.key,
            required: attr.required,
            xdefault: typeof xdefault === "string" ? xdefault : undefined,
          });
          break;
        case "enum":
          await databases.updateEnumAttribute({
            databaseId,
            collectionId,
            key: attr.key,
            elements: attr.elements ?? [],
            required: attr.required,
            xdefault: typeof xdefault === "string" ? xdefault : undefined,
          });
          break;
      }
      await waitForAttributeAvailable(databases, databaseId, collectionId, attr.key, pollOptions);
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
      await waitForIndexAvailable(databases, databaseId, collectionId, index.key, pollOptions);
    },

    async deleteIndex(collectionId, key) {
      await databases.deleteIndex({ databaseId, collectionId, key });
    },

    async deleteCollection(collectionId) {
      await databases.deleteCollection({ databaseId, collectionId });
    },
  };
}
