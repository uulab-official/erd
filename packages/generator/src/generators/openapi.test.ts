import { describe, expect, it } from "vitest";
import { openapiGenerator, renderOpenApiSpec } from "./openapi.js";
import type { Attribute, Entity, Model } from "@modelforge/schema-engine";

function idAttr(id: string): Attribute {
  return {
    id,
    name: id,
    logicalName: "ID",
    type: "uuid",
    nullable: false,
    isPrimaryKey: true,
    isForeignKey: false,
    isUnique: true,
  };
}

function customerEntity(): Entity {
  return {
    id: "customer",
    logicalName: "Customer",
    physicalName: "customer",
    tags: [],
    attributes: [
      idAttr("customer_id"),
      {
        id: "customer_email",
        name: "email",
        logicalName: "Email",
        type: "string",
        nullable: false,
        isPrimaryKey: false,
        isForeignKey: false,
        isUnique: true,
      },
      {
        id: "customer_bio",
        name: "bio",
        logicalName: "Bio",
        type: "string",
        nullable: true,
        isPrimaryKey: false,
        isForeignKey: false,
        isUnique: false,
      },
    ],
    indexes: [],
    ui: { x: 0, y: 0 },
  };
}

function baseModel(): Model {
  return {
    id: "shop",
    name: "Shop",
    adapter: "postgresql",
    entities: [customerEntity()],
    relationships: [],
    views: [],
    sequences: [],
    enums: [],
  };
}

describe("renderOpenApiSpec", () => {
  it("declares openapi version and info from the model name", () => {
    const spec = renderOpenApiSpec(baseModel());
    expect(spec.openapi).toBe("3.0.3");
    expect(spec.info).toMatchObject({ title: "Shop" });
  });

  it("renders a component schema per entity with mapped property types and required from non-nullable", () => {
    const spec = renderOpenApiSpec(baseModel());
    const schema = spec.components.schemas.Customer!;
    expect(schema.properties.customer_id).toEqual({
      type: "string",
      format: "uuid",
      readOnly: true,
    });
    expect(schema.properties.email).toEqual({ type: "string" });
    expect(schema.required).toEqual(["customer_id", "email"]);
    expect(schema.required).not.toContain("bio");
  });

  it("renders collection GET/POST and item GET/PUT/DELETE paths using the pluralized physical name", () => {
    const spec = renderOpenApiSpec(baseModel());
    const paths = spec.paths;
    expect(Object.keys(paths["/customers"]!)).toEqual(["get", "post"]);
    expect(Object.keys(paths["/customers/{customer_id}"]!)).toEqual(["get", "put", "delete"]);
  });

  it("references the entity's component schema from its paths", () => {
    const spec = renderOpenApiSpec(baseModel());
    const paths = spec.paths;
    expect(paths["/customers"]!.post!.requestBody!.content["application/json"]!.schema).toEqual({
      $ref: "#/components/schemas/Customer",
    });
    expect(
      paths["/customers"]!.get!.responses["200"]!.content!["application/json"]!.schema,
    ).toEqual({
      type: "array",
      items: { $ref: "#/components/schemas/Customer" },
    });
  });

  it("omits item-level paths when the entity has no primary key", () => {
    const model = baseModel();
    model.entities[0]!.attributes = model.entities[0]!.attributes.map((a) => ({
      ...a,
      isPrimaryKey: false,
    }));
    const spec = renderOpenApiSpec(model);
    const paths = spec.paths;
    expect(paths["/customers"]).toBeDefined();
    expect(Object.keys(paths).some((p) => p.includes("{"))).toBe(false);
  });
});

describe("openapiGenerator", () => {
  it("emits a single valid-JSON openapi.json file", async () => {
    const files = await openapiGenerator.generate(baseModel());
    expect(files).toHaveLength(1);
    expect(files[0]?.path).toBe("openapi.json");
    expect(() => JSON.parse(files[0]!.content)).not.toThrow();
  });

  it("declares its category as api-doc", () => {
    expect(openapiGenerator.category).toBe("api-doc");
  });
});
