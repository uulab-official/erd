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

// Appwrite's Attributes API never lists the system $id field — it's implicit on every
// collection — so importing without adding it back would make every entity look like it
// has no primary key. This is a plain Attribute (not a real Appwrite attribute), so
// toNativeSchema re-exporting it is harmless: "id" isn't an Appwrite reserved key.
function syntheticIdAttribute(collectionId: string): Entity["attributes"][number] {
  return {
    id: `${collectionId}_id`,
    name: "id",
    logicalName: "ID",
    type: "string",
    length: 20,
    nullable: false,
    isPrimaryKey: true,
    isForeignKey: false,
    isUnique: true,
    comment: "Maps to Appwrite's built-in $id",
  };
}

export function fromNativeSchema(native: AppwriteNativeSchema): Model {
  const entities: Entity[] = native.collections.map((collection, index) => {
    const plainAttributes = collection.attributes
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
      }));
    // Only synthesize $id if the export doesn't already have its own "id" attribute —
    // otherwise this would collide with it under a different attribute id.
    const needsSyntheticId = !plainAttributes.some((attr) => attr.name === "id");

    return {
      id: collection.id,
      logicalName: collection.name,
      physicalName: collection.id,
      tags: [],
      attributes: needsSyntheticId
        ? [syntheticIdAttribute(collection.id), ...plainAttributes]
        : plainAttributes,
      indexes: collection.indexes.map((idx) => ({
        id: idx.key,
        name: idx.key,
        attributeIds: idx.attributes,
        unique: idx.type === "unique",
        type: idx.type === "fulltext" ? ("fulltext" as const) : undefined,
      })),
      ui: { x: index * 280, y: 0 },
    };
  });

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
