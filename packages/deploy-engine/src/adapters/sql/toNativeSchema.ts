import type { Entity, Model } from "@modelforge/schema-engine";
import type { SqlDialect } from "./dialect.js";
import type { SqlForeignKeyDef, SqlNativeSchema, SqlTableDef } from "./types.js";

function toTable(entity: Entity, model: Model, dialect: SqlDialect): SqlTableDef {
  const columns = entity.attributes.map((attr) => ({
    name: attr.name,
    type: dialect.mapType(attr.type, attr.length, attr.scale),
    nullable: attr.nullable,
    default: attr.default ?? null,
  }));

  const primaryKey = entity.attributes.filter((a) => a.isPrimaryKey).map((a) => a.name);

  const indexes = entity.indexes.map((index) => ({
    name: index.name,
    unique: index.unique,
    columns: index.attributeIds
      .map((id) => entity.attributes.find((a) => a.id === id)?.name)
      .filter((name): name is string => Boolean(name)),
  }));

  // The FK columns live on the "many" side (targetEntityId), referencing the "one" side
  // (sourceEntityId) — see docs/schema-engine.md's Relationship shape.
  const foreignKeys: SqlForeignKeyDef[] = model.relationships
    .filter((rel) => rel.targetEntityId === entity.id)
    .map((rel) => {
      const source = model.entities.find((e) => e.id === rel.sourceEntityId);
      const columns = rel.targetAttributeIds
        .map((id) => entity.attributes.find((a) => a.id === id)?.name)
        .filter((name): name is string => Boolean(name));
      const referencedColumns = rel.sourceAttributeIds
        .map((id) => source?.attributes.find((a) => a.id === id)?.name)
        .filter((name): name is string => Boolean(name));
      return {
        name: `fk_${entity.physicalName}_${rel.name ?? rel.id}`,
        columns,
        referencedTable: source?.physicalName ?? rel.sourceEntityId,
        referencedColumns,
        onDelete: rel.onDelete ?? "no-action",
        onUpdate: rel.onUpdate ?? "no-action",
      };
    });

  return { name: entity.physicalName, columns, primaryKey, indexes, foreignKeys };
}

export function toNativeSchema(model: Model, dialect: SqlDialect): SqlNativeSchema {
  return { tables: model.entities.map((entity) => toTable(entity, model, dialect)) };
}
