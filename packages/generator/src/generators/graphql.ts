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

// PK/FK columns are exposed as GraphQL's `ID` scalar regardless of their underlying
// storage type — the same convention every GraphQL-over-SQL tool (Postgraphile, Hasura,
// Prisma's own GraphQL layer) uses, since callers reference records by opaque id, not by
// "this is stored as a uuid column."
function mapScalarType(attribute: Attribute): string {
  if (attribute.isPrimaryKey || attribute.isForeignKey) return "ID";
  const byColumnType: Record<ColumnType, string> = {
    string: "String",
    uuid: "ID",
    enum: "String", // no enum-value tracking on Attribute to generate a real GraphQL enum from
    integer: "Int",
    bigint: "BigInt", // custom scalar — GraphQL's Int is 32-bit
    float: "Float",
    boolean: "Boolean",
    datetime: "DateTime", // custom scalar — GraphQL has no built-in date/time type
    json: "JSON", // custom scalar
  };
  return byColumnType[attribute.type];
}

function renderField(attribute: Attribute): string {
  const type = mapScalarType(attribute) + (attribute.nullable ? "" : "!");
  return `  ${attribute.name}: ${type}`;
}

function renderType(model: Model, entity: Entity, byId: Map<string, Entity>): string {
  const lines: string[] = [`type ${pascalCase(entity.logicalName)} {`];

  for (const attribute of entity.attributes) {
    lines.push(renderField(attribute));
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
  const types = new Set(model.entities.flatMap((e) => e.attributes.map(mapScalarType)));
  return CUSTOM_SCALARS.filter((scalar) => types.has(scalar));
}

// Model -> a single schema.graphql SDL document: custom scalars actually referenced,
// one `type` per Entity, and a Query root exposing list/get per Entity. Field naming
// mirrors the Prisma generator's conventions (pascalCase types, lowerFirst/pluralize
// relation field names) so the two generated schemas read as the same domain model in
// two different languages.
export function renderGraphqlSchema(model: Model): string {
  const byId = new Map(model.entities.map((e) => [e.id, e]));
  const scalars = usedCustomScalars(model);

  const header = scalars.map((scalar) => `scalar ${scalar}`).join("\n");
  const types = model.entities.map((entity) => renderType(model, entity, byId)).join("\n\n");
  const query = renderQueryType(model);

  return [header, types, query].filter(Boolean).join("\n\n") + "\n";
}

export const graphqlGenerator: CodeGenerator = {
  id: "generator.graphql",
  label: "GraphQL SDL",
  category: "api-doc",
  async generate(model: Model): Promise<GeneratedFile[]> {
    return [{ path: "schema.graphql", content: renderGraphqlSchema(model) }];
  },
};
