import type { Attribute, Entity, Model, Relationship } from "@modelforge/schema-engine";

export function idAttribute(id = "id"): Attribute {
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

export function customerEntity(): Entity {
  return {
    id: "customer",
    logicalName: "Customer",
    physicalName: "customer",
    tags: [],
    attributes: [
      idAttribute(),
      {
        id: "email",
        name: "email",
        logicalName: "Email",
        type: "string",
        length: 320,
        nullable: false,
        isPrimaryKey: false,
        isForeignKey: false,
        isUnique: true,
      },
    ],
    indexes: [{ id: "email_idx", name: "email_idx", attributeIds: ["email"], unique: true }],
    ui: { x: 0, y: 0 },
  };
}

export function orderEntity(): Entity {
  return {
    id: "order",
    logicalName: "Order",
    physicalName: "order",
    tags: [],
    attributes: [
      idAttribute("order_id"),
      {
        id: "customer_id",
        name: "customer_id",
        logicalName: "Customer ID",
        type: "uuid",
        nullable: false,
        isPrimaryKey: false,
        isForeignKey: true,
        isUnique: false,
      },
    ],
    indexes: [],
    ui: { x: 280, y: 0 },
  };
}

export function placesRelationship(): Relationship {
  return {
    id: "r1",
    name: "orders",
    sourceEntityId: "customer",
    targetEntityId: "order",
    cardinality: "one-to-many",
    kind: "non-identifying",
    optionality: "mandatory",
    sourceAttributeIds: ["id"],
    targetAttributeIds: ["customer_id"],
    onDelete: "cascade",
  };
}

export function shopModel(): Model {
  return {
    id: "shop",
    name: "Shop",
    adapter: "appwrite",
    entities: [customerEntity(), orderEntity()],
    relationships: [placesRelationship()],
    views: [],
    sequences: [],
    enums: [],
  };
}
