import { describe, expect, it } from "vitest";
import { graphqlGenerator, renderGraphqlSchema } from "./graphql.js";
import type { Attribute, Entity, Model, Relationship } from "@modelforge/schema-engine";

function idAttr(id: string, type: Attribute["type"] = "uuid"): Attribute {
  return {
    id,
    name: id,
    logicalName: "ID",
    type,
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
        id: "customer_created_at",
        name: "createdAt",
        logicalName: "Created At",
        type: "datetime",
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

function orderEntity(): Entity {
  return {
    id: "order",
    logicalName: "Order",
    physicalName: "order",
    tags: [],
    attributes: [
      idAttr("order_id"),
      {
        id: "order_customer_id",
        name: "customerId",
        logicalName: "Customer ID",
        type: "uuid",
        nullable: false,
        isPrimaryKey: false,
        isForeignKey: true,
        isUnique: false,
      },
    ],
    indexes: [],
    ui: { x: 0, y: 0 },
  };
}

function oneToManyRel(): Relationship {
  return {
    id: "r1",
    name: "orders",
    sourceEntityId: "customer",
    targetEntityId: "order",
    cardinality: "one-to-many",
    kind: "non-identifying",
    optionality: "mandatory",
    sourceAttributeIds: ["customer_id"],
    targetAttributeIds: ["order_customer_id"],
  };
}

function baseModel(relationships: Relationship[] = [oneToManyRel()]): Model {
  return {
    id: "shop",
    name: "Shop",
    adapter: "postgresql",
    entities: [customerEntity(), orderEntity()],
    relationships,
    views: [],
    sequences: [],
    enums: [],
  };
}

describe("renderGraphqlSchema", () => {
  it("renders a type per entity with PK/FK columns mapped to ID", () => {
    const schema = renderGraphqlSchema(baseModel());
    expect(schema).toContain("type Customer {");
    expect(schema).toContain("type Order {");
    expect(schema).toContain("customer_id: ID!");
    expect(schema).toContain("customerId: ID!");
  });

  it("maps scalar types and applies '!' only to non-nullable fields", () => {
    const schema = renderGraphqlSchema(baseModel());
    expect(schema).toContain("email: String!");
    expect(schema).toContain("createdAt: DateTime"); // nullable — no '!'
    expect(schema).not.toContain("createdAt: DateTime!");
  });

  it("declares custom scalars only when actually used", () => {
    const schema = renderGraphqlSchema(baseModel());
    expect(schema).toContain("scalar DateTime");
    expect(schema).not.toContain("scalar BigInt");
    expect(schema).not.toContain("scalar JSON");
  });

  it("renders a one-to-many relation as a non-null list on the source and a reference on the target", () => {
    const schema = renderGraphqlSchema(baseModel());
    expect(schema).toContain("orders: [Order!]!");
    expect(schema).toContain("customer: Customer!");
  });

  it("renders a one-to-one relation as an optional singular reference on the source", () => {
    const rel: Relationship = { ...oneToManyRel(), cardinality: "one-to-one" };
    const schema = renderGraphqlSchema(baseModel([rel]));
    expect(schema).toContain("order: Order");
    expect(schema).not.toContain("order: Order!");
  });

  it("renders many-to-many as non-null list fields on both sides with no scalar FK reference field", () => {
    const rel: Relationship = { ...oneToManyRel(), cardinality: "many-to-many" };
    const schema = renderGraphqlSchema(baseModel([rel]));
    expect(schema).toContain("orders: [Order!]!");
    expect(schema).toContain("customers: [Customer!]!");
    expect(schema).not.toContain("customer: Customer");
  });

  it("renders a Query type with a list field and an id-lookup field per entity", () => {
    const schema = renderGraphqlSchema(baseModel());
    expect(schema).toContain("type Query {");
    expect(schema).toContain("customers: [Customer!]!");
    expect(schema).toContain("customer(customer_id: ID!): Customer");
    expect(schema).toContain("orders: [Order!]!");
    expect(schema).toContain("order(order_id: ID!): Order");
  });
});

describe("graphqlGenerator", () => {
  it("emits a single schema.graphql file", async () => {
    const files = await graphqlGenerator.generate(baseModel());
    expect(files).toHaveLength(1);
    expect(files[0]?.path).toBe("schema.graphql");
  });

  it("declares its category as api-doc", () => {
    expect(graphqlGenerator.category).toBe("api-doc");
  });
});
