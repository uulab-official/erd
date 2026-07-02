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

// Appwrite's Attributes API (and thus both `appwrite.json` exports and a live
// listCollections() call — same wire format) uses "double" for what we call "float", and
// has several string-ish variants (email/url/ip, plus TablesDB's varchar/text/mediumtext/
// longtext) that all map onto our single "string" type. Unrecognized types fall back to
// "string" rather than throwing, since this is a read path and we'd rather import an
// approximate attribute than fail the whole collection.
const ATTRIBUTE_TYPE_ALIASES: Record<string, AppwriteAttributeType> = {
  string: "string",
  varchar: "string",
  text: "string",
  mediumtext: "string",
  longtext: "string",
  email: "string",
  url: "string",
  ip: "string",
  integer: "integer",
  bigint: "integer",
  float: "float",
  double: "float",
  boolean: "boolean",
  datetime: "datetime",
  enum: "enum",
};

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

  const type = ATTRIBUTE_TYPE_ALIASES[attr.type] ?? "string";
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
