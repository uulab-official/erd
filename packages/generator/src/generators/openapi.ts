import type { Attribute, ColumnType, Entity, Model } from "@modelforge/schema-engine";
import type { CodeGenerator, GeneratedFile } from "@modelforge/sdk";

function pascalCase(name: string): string {
  return name
    .replace(/[_\s-]+(.)/g, (_, char: string) => char.toUpperCase())
    .replace(/^(.)/, (char) => char.toUpperCase());
}

// Naive English pluralization — same limitation as the Prisma/GraphQL generators'
// (generated path segments like `/orders`; anyone who cares about a correct plural
// renames it by hand).
function pluralize(name: string): string {
  if (/[sxz]$/.test(name) || /[cs]h$/.test(name)) return `${name}es`;
  if (/[^aeiou]y$/.test(name)) return `${name.slice(0, -1)}ies`;
  return `${name}s`;
}

export interface JsonSchemaProperty {
  type: string;
  format?: string;
  readOnly?: true;
  additionalProperties?: true;
}

export interface EntitySchema {
  type: "object";
  properties: Record<string, JsonSchemaProperty>;
  required?: string[];
}

export interface OpenApiOperation {
  summary: string;
  parameters?: { name: string; in: string; required: true; schema: JsonSchemaProperty }[];
  requestBody?: { required: true; content: Record<string, { schema: unknown }> };
  responses: Record<string, { description: string; content?: Record<string, { schema: unknown }> }>;
}

export interface OpenApiDocument {
  openapi: "3.0.3";
  info: { title: string; version: string };
  paths: Record<string, Record<string, OpenApiOperation>>;
  components: { schemas: Record<string, EntitySchema> };
}

function mapPropertySchema(attribute: Attribute): JsonSchemaProperty {
  const byColumnType: Record<ColumnType, JsonSchemaProperty> = {
    string: { type: "string" },
    uuid: { type: "string", format: "uuid" },
    enum: { type: "string" },
    integer: { type: "integer", format: "int32" },
    bigint: { type: "integer", format: "int64" },
    float: { type: "number", format: attribute.scale !== undefined ? "double" : "float" },
    boolean: { type: "boolean" },
    datetime: { type: "string", format: "date-time" },
    json: { type: "object", additionalProperties: true },
  };
  const schema = { ...byColumnType[attribute.type] };
  // PK values are server-generated (uuid/serial/etc.) — clients read them but never
  // supply one on create, the same convention the SQL/Prisma adapters already assume.
  if (attribute.isPrimaryKey) schema.readOnly = true;
  return schema;
}

function entitySchema(entity: Entity): EntitySchema {
  const properties: Record<string, JsonSchemaProperty> = {};
  const required: string[] = [];
  for (const attribute of entity.attributes) {
    properties[attribute.name] = mapPropertySchema(attribute);
    if (!attribute.nullable) required.push(attribute.name);
  }
  return {
    type: "object",
    properties,
    ...(required.length > 0 ? { required } : {}),
  };
}

// A conventional REST resource path per Entity — GET (list) + POST on the collection,
// GET/PUT/DELETE on the item — the same CRUD shape every REST-over-SQL scaffolder
// (json-server, PostgREST, Hasura's REST layer) generates. No custom actions or
// filtering/pagination query params: those vary per API and would mean guessing at a
// convention rather than a mechanical mapping, the same scoping call made for GraphQL's
// Mutation type.
function entityPaths(
  entity: Entity,
  schemaName: string,
): Record<string, Record<string, OpenApiOperation>> {
  const ref = { $ref: `#/components/schemas/${schemaName}` };
  const listRef = { type: "array", items: ref };
  const primaryKey = entity.attributes.find((a) => a.isPrimaryKey);
  const idParam: NonNullable<OpenApiOperation["parameters"]> = primaryKey
    ? [
        {
          name: primaryKey.name,
          in: "path",
          required: true,
          schema: mapPropertySchema(primaryKey),
        },
      ]
    : [];

  const collectionPath = `/${pluralize(entity.physicalName)}`;
  const itemPath = primaryKey ? `${collectionPath}/{${primaryKey.name}}` : collectionPath;

  const paths: Record<string, Record<string, OpenApiOperation>> = {
    [collectionPath]: {
      get: {
        summary: `List ${schemaName} records`,
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: listRef } } },
        },
      },
      post: {
        summary: `Create a ${schemaName}`,
        requestBody: { required: true, content: { "application/json": { schema: ref } } },
        responses: {
          "201": { description: "Created", content: { "application/json": { schema: ref } } },
        },
      },
    },
  };

  if (primaryKey) {
    paths[itemPath] = {
      get: {
        summary: `Get a ${schemaName} by ${primaryKey.name}`,
        parameters: idParam,
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: ref } } },
          "404": { description: "Not found" },
        },
      },
      put: {
        summary: `Update a ${schemaName}`,
        parameters: idParam,
        requestBody: { required: true, content: { "application/json": { schema: ref } } },
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: ref } } },
        },
      },
      delete: {
        summary: `Delete a ${schemaName}`,
        parameters: idParam,
        responses: { "204": { description: "Deleted" } },
      },
    };
  }

  return paths;
}

// Model -> OpenAPI 3.0 document: one `components.schemas` entry per Entity (JSON Schema
// property types derived the same way as GraphQL's scalar mapping, minus the ID-for-PK/
// FK special case — OpenAPI has no equivalent opaque-id convention, so PK/FK columns
// keep their real storage type) and a conventional REST CRUD path set per Entity.
export function renderOpenApiSpec(model: Model): OpenApiDocument {
  const schemas: Record<string, EntitySchema> = {};
  const paths: Record<string, Record<string, OpenApiOperation>> = {};

  for (const entity of model.entities) {
    const schemaName = pascalCase(entity.logicalName);
    schemas[schemaName] = entitySchema(entity);
    Object.assign(paths, entityPaths(entity, schemaName));
  }

  return {
    openapi: "3.0.3",
    info: { title: model.name, version: "1.0.0" },
    paths,
    components: { schemas },
  };
}

export const openapiGenerator: CodeGenerator = {
  id: "generator.openapi",
  label: "OpenAPI",
  category: "api-doc",
  async generate(model: Model): Promise<GeneratedFile[]> {
    return [{ path: "openapi.json", content: JSON.stringify(renderOpenApiSpec(model), null, 2) }];
  },
};
