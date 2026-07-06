import type { Entity, Model, Relationship } from "@modelforge/schema-engine";
import { defaultSizeFor, mapColumnTypeToAppwrite } from "./typeMap.js";
import type {
  AppwriteAttributeDef,
  AppwriteCollectionDef,
  AppwriteNativeSchema,
  AppwriteOnDelete,
  AppwriteRelationshipAttributeDef,
  AppwriteRelationType,
} from "./types.js";

function mapCardinalityToRelationType(
  cardinality: Relationship["cardinality"],
): AppwriteRelationType {
  switch (cardinality) {
    case "one-to-one":
      return "oneToOne";
    case "one-to-many":
      return "oneToMany";
    case "many-to-many":
      return "manyToMany";
  }
}

function mapOnDelete(onDelete: Relationship["onDelete"]): AppwriteOnDelete {
  switch (onDelete) {
    case "cascade":
      return "cascade";
    case "set-null":
      return "setNull";
    default:
      return "restrict";
  }
}

function toCollection(entity: Entity, model: Model): AppwriteCollectionDef {
  // A Relationship's FK column (isForeignKey === true, the "many" side) is represented
  // as a single Appwrite relationship attribute instead — see "Relationship은 Appwrite
  // Relationship Attribute로 매핑" in /docs/adapters.md. The PK it references on the "one"
  // side is a plain attribute like any other; only the FK column itself is folded away.
  const relationshipsFromHere = model.relationships.filter((r) => r.sourceEntityId === entity.id);

  const plainAttributes: AppwriteAttributeDef[] = entity.attributes
    .filter((attr) => !attr.isForeignKey)
    .map((attr) => {
      // Appwrite's native "enum" attribute requires a real `elements` array (its
      // createEnumAttribute call fails without one) — an elements-less enum attribute
      // would deploy broken, worse than the plain-string fallback the SQL dialects use
      // for the same dangling-enumId case. So a dangling enumId falls back to "string"
      // here rather than emitting type "enum" with no elements.
      const enumType =
        attr.type === "enum" ? model.enums.find((e) => e.id === attr.enumId) : undefined;
      const type =
        attr.type === "enum" && !enumType ? "string" : mapColumnTypeToAppwrite(attr.type);
      return {
        key: attr.name,
        type,
        required: !attr.nullable,
        array: false,
        size: defaultSizeFor(attr.type, attr.length),
        default: attr.default ?? null,
        ...(enumType ? { elements: enumType.values } : {}),
      };
    });

  const relationshipAttributes: AppwriteRelationshipAttributeDef[] = relationshipsFromHere.map(
    (rel) => ({
      key: rel.name ?? rel.targetEntityId,
      type: "relationship",
      relatedCollection: rel.targetEntityId,
      relationType: mapCardinalityToRelationType(rel.cardinality),
      twoWay: true,
      onDelete: mapOnDelete(rel.onDelete),
    }),
  );

  const indexes = entity.indexes.map((index) => ({
    key: index.name,
    type: (index.unique ? "unique" : index.type === "fulltext" ? "fulltext" : "key") as
      "key" | "unique" | "fulltext",
    attributes: index.attributeIds
      .map((id) => entity.attributes.find((a) => a.id === id)?.name)
      .filter((name): name is string => Boolean(name)),
  }));

  // Composite PK fallback: Appwrite has no native composite primary key, only its own
  // system $id — so multiple isPrimaryKey attributes become a unique index instead.
  const primaryKeyAttributes = entity.attributes.filter((a) => a.isPrimaryKey);
  if (primaryKeyAttributes.length > 1) {
    indexes.push({
      key: `${entity.physicalName}_pk`,
      type: "unique",
      attributes: primaryKeyAttributes.map((a) => a.name),
    });
  }

  return {
    id: entity.physicalName,
    name: entity.logicalName,
    attributes: [...plainAttributes, ...relationshipAttributes],
    indexes,
  };
}

export function toNativeSchema(model: Model): AppwriteNativeSchema {
  return { collections: model.entities.map((entity) => toCollection(entity, model)) };
}
