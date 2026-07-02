import { Databases, Query } from "node-appwrite";
import type { Client } from "node-appwrite";

// Mirrors the shape Appwrite's CLI writes to appwrite.json (`appwrite pull collections`):
// a bare {$id, name, attributes, indexes} per collection, straight from the Attributes/
// Indexes API. This Function intentionally does no attribute-shape translation of its
// own — the caller feeds the result through @modelforge/deploy-engine's
// parseAppwriteJson + fromNativeSchema, the exact same parsing already used for the
// static-file import path (see packages/deploy-engine/src/adapters/appwrite/appwriteJson.ts).
export interface ListedCollection {
  $id: string;
  name: string;
  attributes: unknown[];
  indexes: unknown[];
}

export interface ListSchemaResult {
  collections: ListedCollection[];
}

const PAGE_SIZE = 100;

// listCollections() paginates (Appwrite's own default is 25 per page); loop with a
// cursor on $id so projects with more than PAGE_SIZE collections still import fully.
export async function listSchema(client: Client, databaseId: string): Promise<ListSchemaResult> {
  const databases = new Databases(client);
  const collections: ListedCollection[] = [];
  let cursor: string | undefined;

  for (;;) {
    const queries = [Query.limit(PAGE_SIZE)];
    if (cursor) queries.push(Query.cursorAfter(cursor));

    const page = await databases.listCollections({ databaseId, queries });
    for (const collection of page.collections) {
      collections.push({
        $id: collection.$id,
        name: collection.name,
        attributes: collection.attributes,
        indexes: collection.indexes,
      });
    }

    if (page.collections.length < PAGE_SIZE) break;
    cursor = page.collections[page.collections.length - 1]?.$id;
  }

  return { collections };
}
