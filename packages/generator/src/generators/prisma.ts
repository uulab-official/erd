import type { Attribute, ColumnType, Entity, Model, Relationship } from "@modelforge/schema-engine";
import type { CodeGenerator, GeneratedFile } from "@modelforge/sdk";

function pascalCase(name: string): string {
  return name
    .replace(/[_\s-]+(.)/g, (_, char: string) => char.toUpperCase())
    .replace(/^(.)/, (char) => char.toUpperCase());
}

function lowerFirst(name: string): string {
  const pascal = pascalCase(name);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

// Naive English pluralization — good enough for generated field names like `orders`;
// anyone who cares about correct plurals will rename the field anyway.
function pluralize(name: string): string {
  if (/[sxz]$/.test(name) || /[cs]h$/.test(name)) return `${name}es`;
  if (/[^aeiou]y$/.test(name)) return `${name.slice(0, -1)}ies`;
  return `${name}s`;
}

function mapScalarType(type: ColumnType, scale: number | undefined): string {
  switch (type) {
    case "string":
    case "uuid":
    case "enum":
      return "String";
    case "integer":
      return "Int";
    case "bigint":
      return "BigInt";
    case "float":
      return scale !== undefined ? "Decimal" : "Float";
    case "boolean":
      return "Boolean";
    case "datetime":
      return "DateTime";
    case "json":
      return "Json";
  }
}

function formatDefaultValue(value: NonNullable<Attribute["default"]>): string {
  return typeof value === "string" ? `"${value.replace(/"/g, '\\"')}"` : String(value);
}

// The FK column on a one-to-one relationship's target side must be @unique in Prisma —
// otherwise it would just be a regular (non-1:1) relation.
function isOneToOneForeignKey(model: Model, entity: Entity, attr: Attribute): boolean {
  return model.relationships.some(
    (rel) =>
      rel.cardinality === "one-to-one" &&
      rel.targetEntityId === entity.id &&
      rel.targetAttributeIds.includes(attr.id),
  );
}

function renderField(model: Model, entity: Entity, attr: Attribute): string {
  const type = mapScalarType(attr.type, attr.scale) + (attr.nullable ? "?" : "");
  const modifiers: string[] = [];
  if (attr.isPrimaryKey) modifiers.push("@id");
  if (!attr.isPrimaryKey && (attr.isUnique || isOneToOneForeignKey(model, entity, attr))) {
    modifiers.push("@unique");
  }
  if (attr.default !== undefined && attr.default !== null) {
    modifiers.push(`@default(${formatDefaultValue(attr.default)})`);
  } else if (attr.isPrimaryKey && attr.type === "uuid") {
    modifiers.push("@default(uuid())");
  }
  return `  ${attr.name} ${type}${modifiers.length ? ` ${modifiers.join(" ")}` : ""}`;
}

// Relations between the same two models need a name (Prisma's @relation("name", ...))
// only when there's more than one — otherwise it's inferred and a name would be noise.
function buildRelationNamer(model: Model): (rel: Relationship) => string | undefined {
  const pairCounts = new Map<string, number>();
  for (const rel of model.relationships) {
    const key = [rel.sourceEntityId, rel.targetEntityId].sort().join("|");
    pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
  }
  return (rel) => {
    const key = [rel.sourceEntityId, rel.targetEntityId].sort().join("|");
    if ((pairCounts.get(key) ?? 0) <= 1) return undefined;
    return rel.name ?? `${rel.sourceEntityId}_${rel.targetEntityId}`;
  };
}

function renderModel(
  model: Model,
  entity: Entity,
  byId: Map<string, Entity>,
  relationName: (rel: Relationship) => string | undefined,
): string {
  const lines: string[] = [`model ${pascalCase(entity.logicalName)} {`];

  for (const attr of entity.attributes) {
    lines.push(renderField(model, entity, attr));
  }

  // This entity holds the FK (it's the relation's target) — a singular relation field
  // pointing back at the source, alongside the scalar FK column(s) rendered above.
  for (const rel of model.relationships) {
    if (rel.targetEntityId !== entity.id || rel.cardinality === "many-to-many") continue;
    const source = byId.get(rel.sourceEntityId);
    const fkNames = rel.targetAttributeIds
      .map((id) => entity.attributes.find((a) => a.id === id)?.name)
      .filter((n): n is string => Boolean(n));
    const refNames = rel.sourceAttributeIds
      .map((id) => source?.attributes.find((a) => a.id === id)?.name)
      .filter((n): n is string => Boolean(n));
    const name = relationName(rel);
    const relationAttr = `@relation(${name ? `"${name}", ` : ""}fields: [${fkNames.join(", ")}], references: [${refNames.join(", ")}])`;
    lines.push(
      `  ${lowerFirst(source?.logicalName ?? rel.sourceEntityId)} ${pascalCase(source?.logicalName ?? rel.sourceEntityId)} ${relationAttr}`,
    );
  }

  // This entity is the relation's source — an array (one-to-many) or optional singular
  // (one-to-one) field on the "one" side, with no scalar column of its own.
  for (const rel of model.relationships) {
    if (rel.sourceEntityId !== entity.id || rel.cardinality === "many-to-many") continue;
    const target = byId.get(rel.targetEntityId);
    const targetName = pascalCase(target?.logicalName ?? rel.targetEntityId);
    const fieldName =
      rel.cardinality === "one-to-many"
        ? pluralize(lowerFirst(target?.logicalName ?? rel.targetEntityId))
        : lowerFirst(target?.logicalName ?? rel.targetEntityId);
    const typeStr = rel.cardinality === "one-to-many" ? `${targetName}[]` : `${targetName}?`;
    lines.push(`  ${fieldName} ${typeStr}`);
  }

  // Many-to-many is implicit in Prisma: no scalar FK on either side, just an array field
  // naming the other model on both ends.
  for (const rel of model.relationships) {
    if (rel.cardinality !== "many-to-many") continue;
    if (rel.sourceEntityId !== entity.id && rel.targetEntityId !== entity.id) continue;
    const otherId = rel.sourceEntityId === entity.id ? rel.targetEntityId : rel.sourceEntityId;
    const other = byId.get(otherId);
    const fieldName = pluralize(lowerFirst(other?.logicalName ?? otherId));
    lines.push(`  ${fieldName} ${pascalCase(other?.logicalName ?? otherId)}[]`);
  }

  lines.push("}");
  return lines.join("\n");
}

// Model -> schema.prisma. Field naming for relations is derived from entity names, not
// Relationship.name (which tends to read as a verb, e.g. "places" — fine as the
// @relation() disambiguator, awkward as a field name). Entities with more than one
// relation to the same target will get colliding field names — a known limitation to
// resolve by hand, same spirit as the enum->String fallback elsewhere in this package.
export function renderPrismaSchema(model: Model): string {
  const byId = new Map(model.entities.map((e) => [e.id, e]));
  const relationName = buildRelationNamer(model);

  const header = [
    "generator client {",
    '  provider = "prisma-client-js"',
    "}",
    "",
    "datasource db {",
    '  provider = "postgresql"',
    '  url      = env("DATABASE_URL")',
    "}",
    "",
  ].join("\n");

  const models = model.entities
    .map((entity) => renderModel(model, entity, byId, relationName))
    .join("\n\n");

  return `${header}\n${models}\n`;
}

export const prismaGenerator: CodeGenerator = {
  id: "generator.prisma",
  label: "Prisma",
  category: "orm",
  async generate(model: Model): Promise<GeneratedFile[]> {
    return [{ path: "schema.prisma", content: renderPrismaSchema(model) }];
  },
};
