import type { Entity, Model, Relationship } from "@modelforge/schema-engine";
import { mapAppwriteToColumnType } from "./typeMap.js";
import {
  isRelationshipAttribute,
  type AppwriteNativeSchema,
  type AppwriteRelationType,
} from "./types.js";

function mapRelationTypeToCardinality(
  relationType: AppwriteRelationType,
): Relationship["cardinality"] {
  switch (relationType) {
    case "oneToOne":
      return "one-to-one";
    case "oneToMany":
    case "manyToOne":
      return "one-to-many";
    case "manyToMany":
      return "many-to-many";
  }
}

export function fromNativeSchema(native: AppwriteNativeSchema): Model {
  const entities: Entity[] = native.collections.map((collection, index) => ({
    id: collection.id,
    logicalName: collection.name,
    physicalName: collection.id,
    tags: [],
    attributes: collection.attributes
      .filter((attr) => !isRelationshipAttribute(attr))
      .map((attr) => ({
        id: attr.key,
        name: attr.key,
        logicalName: attr.key,
        type: mapAppwriteToColumnType(attr.type),
        length: attr.size,
        nullable: !attr.required,
        isPrimaryKey: false,
        isForeignKey: false,
        isUnique: false,
        default: attr.default ?? undefined,
      })),
    indexes: collection.indexes.map((index) => ({
      id: index.key,
      name: index.key,
      attributeIds: index.attributes,
      unique: index.type === "unique",
      type: index.type === "fulltext" ? "fulltext" : undefined,
    })),
    ui: { x: index * 280, y: 0 },
  }));

  const relationships: Relationship[] = native.collections.flatMap((collection) =>
    collection.attributes.filter(isRelationshipAttribute).map((attr) => ({
      id: `${collection.id}.${attr.key}`,
      name: attr.key,
      sourceEntityId: collection.id,
      targetEntityId: attr.relatedCollection,
      cardinality: mapRelationTypeToCardinality(attr.relationType),
      kind: "non-identifying" as const,
      optionality: "optional" as const,
      sourceAttributeIds: [],
      targetAttributeIds: [],
      onDelete:
        attr.onDelete === "setNull"
          ? ("set-null" as const)
          : (attr.onDelete as "cascade" | "restrict"),
    })),
  );

  return {
    id: "imported",
    name: "Imported from Appwrite",
    adapter: "appwrite",
    entities,
    relationships,
    views: [],
    sequences: [],
    enums: [],
  };
}
