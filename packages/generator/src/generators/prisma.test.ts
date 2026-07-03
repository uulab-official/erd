import { describe, expect, it } from "vitest";
import { prismaGenerator, renderPrismaSchema } from "./prisma.js";
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

describe("renderPrismaSchema", () => {
  it("includes generator and datasource blocks", () => {
    const schema = renderPrismaSchema(baseModel());
    expect(schema).toContain('provider = "prisma-client-js"');
    expect(schema).toContain('provider = "postgresql"');
  });

  it("renders a model per entity with @id on the primary key", () => {
    const schema = renderPrismaSchema(baseModel());
    expect(schema).toContain("model Customer {");
    expect(schema).toContain("model Order {");
    expect(schema).toMatch(/customer_id\s+String\s+@id\s+@default\(uuid\(\)\)/);
  });

  it("renders a one-to-many relation as an array field on the source and a @relation on the target", () => {
    const schema = renderPrismaSchema(baseModel());
    expect(schema).toContain("orders Order[]");
    expect(schema).toMatch(
      /customer Customer @relation\(fields: \[customerId\], references: \[customer_id\]\)/,
    );
  });

  it("marks a one-to-one FK column as @unique", () => {
    const rel: Relationship = { ...oneToManyRel(), cardinality: "one-to-one" };
    const schema = renderPrismaSchema(baseModel([rel]));
    expect(schema).toMatch(/customerId\s+String\s+@unique/);
    expect(schema).toContain("order Order?");
  });

  it("renders many-to-many as implicit array fields with no scalar FK", () => {
    const rel: Relationship = { ...oneToManyRel(), cardinality: "many-to-many" };
    const schema = renderPrismaSchema(baseModel([rel]));
    expect(schema).not.toContain("@relation");
    expect(schema).toContain("orders Order[]");
    expect(schema).toContain("customers Customer[]");
  });

  it("names the relation only when the same pair has more than one relationship", () => {
    const second: Relationship = { ...oneToManyRel(), id: "r2", name: "priorityOrders" };
    const schema = renderPrismaSchema(baseModel([oneToManyRel(), second]));
    expect(schema).toContain('@relation("orders"');
    expect(schema).toContain('@relation("priorityOrders"');
  });
});

describe("renderPrismaSchema with a real Enum", () => {
  function modelWithEnumAttribute(): Model {
    const model = baseModel([]);
    model.enums = [{ id: "e1", name: "order status", values: ["pending", "in progress!", "42"] }];
    model.entities[1]!.attributes.push({
      id: "order_status",
      name: "status",
      logicalName: "Status",
      type: "enum",
      enumId: "e1",
      nullable: false,
      isPrimaryKey: false,
      isForeignKey: false,
      isUnique: false,
    });
    return model;
  }

  it("emits a real enum block instead of falling back to String", () => {
    const schema = renderPrismaSchema(modelWithEnumAttribute());
    expect(schema).toContain("enum OrderStatus {");
    expect(schema).toContain("status OrderStatus");
    expect(schema).not.toContain("status String");
  });

  it("sanitizes enum values into valid Prisma enum identifiers", () => {
    const schema = renderPrismaSchema(modelWithEnumAttribute());
    expect(schema).toContain("PENDING");
    expect(schema).toContain("IN_PROGRESS");
    expect(schema).toContain("_42");
  });

  it("does not declare an enum block for an EnumType nothing references", () => {
    const model = baseModel();
    model.enums = [{ id: "unused", name: "Unused", values: ["a"] }];
    expect(renderPrismaSchema(model)).not.toContain("enum Unused");
  });

  it("falls back to String when enumId doesn't resolve to a real EnumType", () => {
    const model = baseModel([]);
    model.entities[1]!.attributes.push({
      id: "order_status",
      name: "status",
      logicalName: "Status",
      type: "enum",
      enumId: "missing",
      nullable: false,
      isPrimaryKey: false,
      isForeignKey: false,
      isUnique: false,
    });
    expect(renderPrismaSchema(model)).toContain("status String");
  });
});

describe("prismaGenerator", () => {
  it("emits a single schema.prisma file", async () => {
    const files = await prismaGenerator.generate(baseModel());
    expect(files).toHaveLength(1);
    expect(files[0]?.path).toBe("schema.prisma");
  });

  it("declares its category as orm", () => {
    expect(prismaGenerator.category).toBe("orm");
  });
});
