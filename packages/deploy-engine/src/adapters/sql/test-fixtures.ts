import type { Entity, Model, Relationship } from "@modelforge/schema-engine";

export function customerEntity(): Entity {
  return {
    id: "customer",
    logicalName: "Customer",
    physicalName: "customer",
    tags: [],
    attributes: [
      {
        id: "customer_id",
        name: "id",
        logicalName: "ID",
        type: "uuid",
        nullable: false,
        isPrimaryKey: true,
        isForeignKey: false,
        isUnique: true,
      },
      {
        id: "customer_email",
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
    indexes: [
      { id: "email_idx", name: "email_idx", attributeIds: ["customer_email"], unique: true },
    ],
    ui: { x: 0, y: 0 },
  };
}

export function orderEntity(): Entity {
  return {
    id: "order",
    logicalName: "Order",
    physicalName: "purchase_order",
    tags: [],
    attributes: [
      {
        id: "order_id",
        name: "id",
        logicalName: "ID",
        type: "uuid",
        nullable: false,
        isPrimaryKey: true,
        isForeignKey: false,
        isUnique: true,
      },
      {
        id: "order_customer_id",
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
    name: "places",
    sourceEntityId: "customer",
    targetEntityId: "order",
    cardinality: "one-to-many",
    kind: "non-identifying",
    optionality: "mandatory",
    sourceAttributeIds: ["customer_id"],
    targetAttributeIds: ["order_customer_id"],
    onDelete: "cascade",
  };
}

export function shopModel(): Model {
  return {
    id: "shop",
    name: "Shop",
    adapter: "postgresql",
    entities: [customerEntity(), orderEntity()],
    relationships: [placesRelationship()],
    views: [],
    sequences: [],
    enums: [],
  };
}
