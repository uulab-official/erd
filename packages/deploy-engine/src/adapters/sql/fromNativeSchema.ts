import type { Entity, Model, Relationship } from "@modelforge/schema-engine";
import type { SqlDialect } from "./dialect.js";
import type { SqlNativeSchema } from "./types.js";

export function fromNativeSchema(native: SqlNativeSchema, dialect: SqlDialect): Model {
  const entities: Entity[] = native.tables.map((table, index) => ({
    id: table.name,
    logicalName: table.name,
    physicalName: table.name,
    tags: [],
    attributes: table.columns.map((column) => {
      const { type, length, scale } = dialect.mapTypeBack(column.type);
      return {
        id: `${table.name}.${column.name}`,
        name: column.name,
        logicalName: column.name,
        type,
        length,
        scale,
        nullable: column.nullable,
        isPrimaryKey: table.primaryKey.includes(column.name),
        isForeignKey: table.foreignKeys.some((fk) => fk.columns.includes(column.name)),
        isUnique: false,
        default: column.default ?? undefined,
      };
    }),
    indexes: table.indexes.map((index) => ({
      id: `${table.name}.${index.name}`,
      name: index.name,
      attributeIds: index.columns.map((c) => `${table.name}.${c}`),
      unique: index.unique,
    })),
    ui: { x: index * 280, y: 0 },
  }));

  const relationships: Relationship[] = native.tables.flatMap((table) =>
    table.foreignKeys.map((fk) => ({
      id: fk.name,
      name: fk.name,
      sourceEntityId: fk.referencedTable,
      targetEntityId: table.name,
      cardinality: "one-to-many" as const,
      kind: "non-identifying" as const,
      optionality: "optional" as const,
      sourceAttributeIds: fk.referencedColumns.map((c) => `${fk.referencedTable}.${c}`),
      targetAttributeIds: fk.columns.map((c) => `${table.name}.${c}`),
      onDelete: fk.onDelete,
      onUpdate: fk.onUpdate,
    })),
  );

  // native.sequences/views carry no id of their own (unlike tables, which use their
  // name as the Model entity id above) — reuse the name for the same reason: it's
  // stable and unique within a schema. Enums are NOT reconstructed here: for a
  // checkValues-based dialect (Postgres/SQLite) the allowed values live on the column,
  // recoverable in principle, but for MySQL's native `enum(...)` column type they're
  // baked into the rendered type string itself, requiring dialect-specific parsing —
  // a bigger, separate fix, deferred like the enum-adapter gaps closed earlier.
  const sequences = native.sequences.map((s) => ({
    id: s.name,
    name: s.name,
    start: s.start,
    increment: s.increment,
  }));
  const views = native.views.map((v) => ({ id: v.name, name: v.name, sql: v.sql }));

  return {
    id: "imported",
    name: "Imported from SQL",
    adapter: "postgresql",
    entities,
    relationships,
    views,
    sequences,
    enums: [],
  };
}
