import type { Attribute, Entity, Model, Relationship } from "@modelforge/schema-engine";
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

// Prisma enum values are identifiers (letters/digits/underscore, not starting with a
// digit) — real Enum values (e.g. "in progress", "n/a") often aren't valid as-is.
// Upper-snake-cases and strips anything else. Order matters: the leading/trailing
// underscore trim must run BEFORE the digit-prefix check, or a value like "42" would
// get its safety underscore stripped right back off ("_42" -> "42").
function toEnumValueName(value: string): string {
  const collapsed = value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const safe = /^[0-9]/.test(collapsed) ? `_${collapsed}` : collapsed;
  return safe || "VALUE";
}

function mapScalarType(model: Model, attr: Attribute): string {
  if (attr.type === "enum") {
    const enumType = model.enums.find((e) => e.id === attr.enumId);
    // No linked EnumType (or none yet) falls back to String rather than referencing a
    // model that was never declared.
    return enumType ? pascalCase(enumType.name) : "String";
  }
  switch (attr.type) {
    case "string":
    case "uuid":
      return "String";
    case "integer":
      return "Int";
    case "bigint":
      return "BigInt";
    case "float":
      return attr.scale !== undefined ? "Decimal" : "Float";
    case "boolean":
      return "Boolean";
    case "datetime":
      return "DateTime";
    case "json":
      return "Json";
  }
}

// One `enum` block per EnumType actually referenced by some attribute — unreferenced
// entries in Model.enums (created but never assigned) are skipped.
function renderEnumBlocks(model: Model): string[] {
  const referencedIds = new Set(
    model.entities
      .flatMap((e) => e.attributes.map((a) => a.enumId))
      .filter((id): id is string => id !== undefined),
  );
  return model.enums
    .filter((e) => referencedIds.has(e.id))
    .map((enumType) => {
      const values = enumType.values.map((v) => `  ${toEnumValueName(v)}`).join("\n");
      return `enum ${pascalCase(enumType.name)} {\n${values}\n}`;
    });
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

// Mirrors toNativeSchema.ts's soleAutoIncrementAttribute rule exactly (SQL adapter):
// auto-increment only makes sense for a sole integer/bigint PK with no explicit default
// — a composite PK or an explicit default means the database isn't assigning the value.
// Without this, the generated schema.prisma required every insert to supply its own id,
// even though the deployed SQL table (serial/bigserial/AUTO_INCREMENT) does it for you.
function isSoleAutoIncrementPrimaryKey(entity: Entity, attr: Attribute): boolean {
  const primaryKeyAttrs = entity.attributes.filter((a) => a.isPrimaryKey);
  return (
    primaryKeyAttrs.length === 1 &&
    primaryKeyAttrs[0]?.id === attr.id &&
    (attr.type === "integer" || attr.type === "bigint") &&
    (attr.default === undefined || attr.default === null)
  );
}

function renderField(model: Model, entity: Entity, attr: Attribute): string {
  const type = mapScalarType(model, attr) + (attr.nullable ? "?" : "");
  const modifiers: string[] = [];
  if (attr.isPrimaryKey) modifiers.push("@id");
  if (!attr.isPrimaryKey && (attr.isUnique || isOneToOneForeignKey(model, entity, attr))) {
    modifiers.push("@unique");
  }
  if (attr.default !== undefined && attr.default !== null) {
    modifiers.push(`@default(${formatDefaultValue(attr.default)})`);
  } else if (attr.isPrimaryKey && attr.type === "uuid") {
    modifiers.push("@default(uuid())");
  } else if (isSoleAutoIncrementPrimaryKey(entity, attr)) {
    modifiers.push("@default(autoincrement())");
  }
  return `  ${attr.name} ${type}${modifiers.length ? ` ${modifiers.join(" ")}` : ""}`;
}

// Entity.indexes -> @@index/@@unique block attributes. A single-column unique Index
// that just duplicates the attribute's own @id/@unique (already rendered by
// renderField from isPrimaryKey/isUnique) would be a redundant constraint Prisma
// rejects as a duplicate — skipped, mirroring toNativeSchema.ts's identical
// "isUnique && !isPrimaryKey" guard in the SQL adapter.
function renderIndexBlocks(entity: Entity): string[] {
  return entity.indexes
    .map((index) => {
      const columns = index.attributeIds
        .map((id) => entity.attributes.find((a) => a.id === id)?.name)
        .filter((name): name is string => Boolean(name));
      if (columns.length === 0) return undefined;
      if (index.unique && columns.length === 1) {
        const attr = entity.attributes.find((a) => a.name === columns[0]);
        if (attr?.isPrimaryKey || attr?.isUnique) return undefined;
      }
      const directive = index.unique ? "@@unique" : "@@index";
      const mapName = index.name.replace(/"/g, '\\"');
      return `  ${directive}([${columns.join(", ")}], map: "${mapName}")`;
    })
    .filter((line): line is string => Boolean(line));
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

  lines.push(...renderIndexBlocks(entity));

  lines.push("}");
  return lines.join("\n");
}

// Model -> schema.prisma. Field naming for relations is derived from entity names, not
// Relationship.name (which tends to read as a verb, e.g. "places" — fine as the
// @relation() disambiguator, awkward as a field name). Entities with more than one
// relation to the same target will get colliding field names — a known limitation to
// resolve by hand.
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

  const enums = renderEnumBlocks(model).join("\n\n");
  const models = model.entities
    .map((entity) => renderModel(model, entity, byId, relationName))
    .join("\n\n");

  return `${header}\n${[enums, models].filter(Boolean).join("\n\n")}\n`;
}

export const prismaGenerator: CodeGenerator = {
  id: "generator.prisma",
  label: "Prisma",
  category: "orm",
  async generate(model: Model): Promise<GeneratedFile[]> {
    return [{ path: "schema.prisma", content: renderPrismaSchema(model) }];
  },
};
