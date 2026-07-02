import type {
  AppwriteAttributeType,
  AppwriteCollectionDef,
  AppwriteIndexDef,
  AppwriteNativeSchema,
  AppwriteOnDelete,
  AppwriteRelationType,
} from "./types.js";

// Shape of Appwrite CLI's appwrite.json (as produced by `appwrite pull collections` /
// `appwrite init collection`) — a real Appwrite project's schema, exported to a static
// file. Importing from this avoids needing a live server-side admin connection (see
// AppwriteAdminAPI in adapter.ts) for the read-only "bring my existing project in" case.
// Only the fields we map are declared; the CLI file has many more we ignore.
interface AppwriteJsonAttribute {
  key: string;
  type: string;
  status?: string;
  required?: boolean;
  array?: boolean;
  size?: number;
  default?: string | number | boolean | null;
  elements?: string[];
  relatedCollection?: string;
  relationType?: string;
  twoWay?: boolean;
  onDelete?: string;
  side?: string;
}

interface AppwriteJsonIndex {
  key: string;
  type: string;
  attributes: string[];
}

interface AppwriteJsonCollection {
  $id: string;
  name: string;
  attributes?: AppwriteJsonAttribute[];
  indexes?: AppwriteJsonIndex[];
}

interface AppwriteJsonFile {
  collections?: AppwriteJsonCollection[];
}

const ATTRIBUTE_TYPES = new Set<AppwriteAttributeType>([
  "string",
  "integer",
  "float",
  "boolean",
  "datetime",
  "enum",
]);

const RELATION_TYPES = new Set<AppwriteRelationType>([
  "oneToOne",
  "oneToMany",
  "manyToOne",
  "manyToMany",
]);

function parseAttribute(attr: AppwriteJsonAttribute) {
  if (attr.type === "relationship") {
    if (!attr.relatedCollection) {
      throw new Error(`Relationship attribute "${attr.key}" is missing relatedCollection`);
    }
    const relationType = RELATION_TYPES.has(attr.relationType as AppwriteRelationType)
      ? (attr.relationType as AppwriteRelationType)
      : "oneToMany";
    const onDelete: AppwriteOnDelete =
      attr.onDelete === "cascade" || attr.onDelete === "setNull" ? attr.onDelete : "restrict";
    return {
      key: attr.key,
      type: "relationship" as const,
      relatedCollection: attr.relatedCollection,
      relationType,
      twoWay: attr.twoWay ?? false,
      onDelete,
    };
  }

  const type = ATTRIBUTE_TYPES.has(attr.type as AppwriteAttributeType)
    ? (attr.type as AppwriteAttributeType)
    : "string";
  return {
    key: attr.key,
    type,
    required: attr.required ?? false,
    array: attr.array ?? false,
    size: attr.size,
    default: attr.default ?? null,
    elements: attr.elements,
  };
}

function parseIndex(index: AppwriteJsonIndex): AppwriteIndexDef {
  const type: AppwriteIndexDef["type"] =
    index.type === "unique" || index.type === "fulltext" ? index.type : "key";
  return { key: index.key, type, attributes: index.attributes };
}

function parseCollection(collection: AppwriteJsonCollection): AppwriteCollectionDef {
  return {
    id: collection.$id,
    name: collection.name,
    attributes: (collection.attributes ?? []).map(parseAttribute),
    indexes: (collection.indexes ?? []).map(parseIndex),
  };
}

export function parseAppwriteJson(raw: string): AppwriteNativeSchema {
  let file: AppwriteJsonFile;
  try {
    file = JSON.parse(raw) as AppwriteJsonFile;
  } catch {
    throw new Error("Not valid JSON");
  }
  if (!Array.isArray(file.collections)) {
    throw new Error('Expected an appwrite.json file with a top-level "collections" array');
  }
  return { collections: file.collections.map(parseCollection) };
}
