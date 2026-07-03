import type { Attribute, Entity, Model } from "@modelforge/schema-engine";

export function emptyModel(): Model {
  return {
    id: "m1",
    name: "Test",
    adapter: "postgresql",
    entities: [],
    relationships: [],
    views: [],
    sequences: [],
    enums: [],
    domains: [],
    dictionary: [],
    subjectAreas: [],
  };
}

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
    attributes: [idAttribute()],
    indexes: [],
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
      idAttribute(),
      { ...idAttribute("customer_id"), isPrimaryKey: false, isForeignKey: true, isUnique: false },
    ],
    indexes: [],
    ui: { x: 280, y: 0 },
  };
}
