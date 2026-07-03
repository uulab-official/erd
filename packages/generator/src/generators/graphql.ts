import type { Attribute, ColumnType, Entity, Model } from "@modelforge/schema-engine";
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

// Naive English pluralization — same limitation and rationale as the Prisma generator's
// (generated field names like `orders`; anyone who cares about a correct plural renames
// it by hand).
function pluralize(name: string): string {
  if (/[sxz]$/.test(name) || /[cs]h$/.test(name)) return `${name}es`;
  if (/[^aeiou]y$/.test(name)) return `${name.slice(0, -1)}ies`;
  return `${name}s`;
}

// GraphQL enum value names must match /^[_A-Za-z][_0-9A-Za-z]*$/ — real Enum values
// (e.g. "in progress", "n/a") often aren't valid as-is. Upper-snake-cases and strips
// anything else, which is also the SDL convention for enum values. A raw empty result
// (all-punctuation input) falls back to a placeholder rather than emitting `: `.
function toEnumValueName(value: string): string {
  // Strip leading/trailing underscore artifacts BEFORE the digit-prefix check — doing it
  // after would strip the safety underscore right back off a value like "42" -> "_42".
  const collapsed = value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const safe = /^[0-9]/.test(collapsed) ? `_${collapsed}` : collapsed;
  return safe || "VALUE";
}

// PK/FK columns are exposed as GraphQL's `ID` scalar regardless of their underlying
// storage type — the same convention every GraphQL-over-SQL tool (Postgraphile, Hasura,
// Prisma's own GraphQL layer) uses, since callers reference records by opaque id, not by
// "this is stored as a uuid column."
function mapScalarType(model: Model, attribute: Attribute): string {
  if (attribute.isPrimaryKey || attribute.isForeignKey) return "ID";
  if (attribute.type === "enum") {
    const enumType = model.enums.find((e) => e.id === attribute.enumId);
    // No linked EnumType (or none yet) falls back to String rather than emitting a
    // reference to a type that was never declared.
    return enumType ? pascalCase(enumType.name) : "String";
  }
  const byColumnType: Record<Exclude<ColumnType, "enum">, string> = {
    string: "String",
    uuid: "ID",
    integer: "Int",
    bigint: "BigInt", // custom scalar — GraphQL's Int is 32-bit
    float: "Float",
    boolean: "Boolean",
    datetime: "DateTime", // custom scalar — GraphQL has no built-in date/time type
    json: "JSON", // custom scalar
  };
  return byColumnType[attribute.type];
}

function renderField(model: Model, attribute: Attribute): string {
  const type = mapScalarType(model, attribute) + (attribute.nullable ? "" : "!");
  return `  ${attribute.name}: ${type}`;
}

// One `enum` SDL block per EnumType actually referenced by some attribute — unreferenced
// entries in Model.enums (created but never assigned) are skipped, matching the pattern
// custom scalars use below (only declared when used).
function renderEnumTypes(model: Model): string[] {
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

function renderType(model: Model, entity: Entity, byId: Map<string, Entity>): string {
  const lines: string[] = [`type ${pascalCase(entity.logicalName)} {`];

  for (const attribute of entity.attributes) {
    lines.push(renderField(model, attribute));
  }

  // This entity holds the FK (it's the relation's target) — a singular reference field
  // back to the source, alongside the scalar FK column(s) rendered above (same
  // dual scalar-plus-reference convention as the Prisma generator).
  for (const rel of model.relationships) {
    if (rel.targetEntityId !== entity.id || rel.cardinality === "many-to-many") continue;
    const source = byId.get(rel.sourceEntityId);
    const sourceType = pascalCase(source?.logicalName ?? rel.sourceEntityId);
    const fkAttribute = entity.attributes.find((a) => rel.targetAttributeIds.includes(a.id));
    const required = fkAttribute ? !fkAttribute.nullable : rel.optionality === "mandatory";
    lines.push(
      `  ${lowerFirst(source?.logicalName ?? rel.sourceEntityId)}: ${sourceType}${required ? "!" : ""}`,
    );
  }

  // This entity is the relation's source — a non-null list (one-to-many) or an optional
  // singular reference (one-to-one) with no scalar column of its own.
  for (const rel of model.relationships) {
    if (rel.sourceEntityId !== entity.id || rel.cardinality === "many-to-many") continue;
    const target = byId.get(rel.targetEntityId);
    const targetType = pascalCase(target?.logicalName ?? rel.targetEntityId);
    if (rel.cardinality === "one-to-many") {
      const fieldName = pluralize(lowerFirst(target?.logicalName ?? rel.targetEntityId));
      lines.push(`  ${fieldName}: [${targetType}!]!`);
    } else {
      const fieldName = lowerFirst(target?.logicalName ?? rel.targetEntityId);
      lines.push(`  ${fieldName}: ${targetType}`);
    }
  }

  // Many-to-many: a non-null list on both ends, matching the implicit (no scalar FK)
  // convention the Prisma generator uses for the same cardinality.
  for (const rel of model.relationships) {
    if (rel.cardinality !== "many-to-many") continue;
    if (rel.sourceEntityId !== entity.id && rel.targetEntityId !== entity.id) continue;
    const otherId = rel.sourceEntityId === entity.id ? rel.targetEntityId : rel.sourceEntityId;
    const other = byId.get(otherId);
    const fieldName = pluralize(lowerFirst(other?.logicalName ?? otherId));
    lines.push(`  ${fieldName}: [${pascalCase(other?.logicalName ?? otherId)}!]!`);
  }

  lines.push("}");
  return lines.join("\n");
}

// A minimal but real Query root — list + fetch-by-id per Entity — so the generated SDL
// is a usable API contract, not just bare type definitions. No Mutation type: create/
// update/delete conventions (input types, error shapes) vary enough across GraphQL
// servers that generating them would mean guessing at a convention rather than
// generating a mechanical mapping the way the type/list/get fields below are.
function renderQueryType(model: Model): string {
  const lines: string[] = ["type Query {"];
  for (const entity of model.entities) {
    const typeName = pascalCase(entity.logicalName);
    const listField = pluralize(lowerFirst(entity.logicalName));
    const primaryKey = entity.attributes.find((a) => a.isPrimaryKey);
    lines.push(`  ${listField}: [${typeName}!]!`);
    if (primaryKey) {
      lines.push(`  ${lowerFirst(entity.logicalName)}(${primaryKey.name}: ID!): ${typeName}`);
    }
  }
  lines.push("}");
  return lines.join("\n");
}

const CUSTOM_SCALARS = ["BigInt", "DateTime", "JSON"];

function usedCustomScalars(model: Model): string[] {
  const types = new Set(
    model.entities.flatMap((e) => e.attributes.map((a) => mapScalarType(model, a))),
  );
  return CUSTOM_SCALARS.filter((scalar) => types.has(scalar));
}

// Model -> a single schema.graphql SDL document: custom scalars actually referenced,
// real `enum` blocks for every EnumType referenced by an attribute, one `type` per
// Entity, and a Query root exposing list/get per Entity. Field naming mirrors the
// Prisma generator's conventions (pascalCase types, lowerFirst/pluralize relation field
// names) so the two generated schemas read as the same domain model in two languages.
export function renderGraphqlSchema(model: Model): string {
  const byId = new Map(model.entities.map((e) => [e.id, e]));
  const scalars = usedCustomScalars(model);

  const header = scalars.map((scalar) => `scalar ${scalar}`).join("\n");
  const enums = renderEnumTypes(model).join("\n\n");
  const types = model.entities.map((entity) => renderType(model, entity, byId)).join("\n\n");
  const query = renderQueryType(model);

  return [header, enums, types, query].filter(Boolean).join("\n\n") + "\n";
}

export const graphqlGenerator: CodeGenerator = {
  id: "generator.graphql",
  label: "GraphQL SDL",
  category: "api-doc",
  async generate(model: Model): Promise<GeneratedFile[]> {
    return [{ path: "schema.graphql", content: renderGraphqlSchema(model) }];
  },
};
