import { describe, expect, it } from "vitest";
import type { Model } from "@modelforge/schema-engine";
import { mermaidExporter, renderMermaid } from "./mermaid.js";

function shopModel(): Model {
  return {
    id: "m1",
    name: "Shop",
    adapter: "postgresql",
    relationships: [
      {
        id: "r1",
        name: "places",
        sourceEntityId: "customer",
        targetEntityId: "order",
        cardinality: "one-to-many",
        kind: "non-identifying",
        optionality: "mandatory",
        sourceAttributeIds: [],
        targetAttributeIds: [],
      },
    ],
    views: [],
    sequences: [],
    enums: [],
    entities: [
      {
        id: "customer",
        logicalName: "Customer",
        physicalName: "customer",
        tags: [],
        attributes: [
          {
            id: "id",
            name: "id",
            logicalName: "ID",
            type: "uuid",
            nullable: false,
            isPrimaryKey: true,
            isForeignKey: false,
            isUnique: true,
          },
          {
            id: "email",
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
      },
      {
        id: "order",
        logicalName: "Order",
        physicalName: "order",
        tags: [],
        attributes: [
          {
            id: "id",
            name: "id",
            logicalName: "ID",
            type: "uuid",
            nullable: false,
            isPrimaryKey: true,
            isForeignKey: false,
            isUnique: true,
          },
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
        ui: { x: 0, y: 0 },
      },
      {
        id: "tag",
        logicalName: "Tag",
        physicalName: "tag",
        tags: [],
        attributes: [],
        indexes: [],
        ui: { x: 0, y: 0 },
      },
    ],
  };
}

describe("renderMermaid", () => {
  const output = renderMermaid(shopModel());

  it("starts with the erDiagram keyword", () => {
    expect(output.startsWith("erDiagram\n")).toBe(true);
  });

  it("renders each entity's attributes with type, name, and key markers", () => {
    expect(output).toContain("customer {");
    expect(output).toContain("uuid id PK");
    expect(output).toContain("string email UK");
    expect(output).toContain("uuid customer_id FK");
  });

  it("renders an entity with no attributes as a bare name, not an empty block", () => {
    expect(output).toContain("  tag\n");
    expect(output).not.toContain("tag {");
  });

  it("renders one-to-many mandatory relationships with ||--|{ notation and the name as label", () => {
    expect(output).toContain('customer ||--|{ order : "places"');
  });

  it("renders one-to-one relationships as ||--||", () => {
    const model = shopModel();
    model.relationships = [
      { ...model.relationships[0]!, cardinality: "one-to-one", optionality: "mandatory" },
    ];
    expect(renderMermaid(model)).toContain("customer ||--|| order");
  });

  it("renders optional one-to-many as ||--o{", () => {
    const model = shopModel();
    model.relationships = [{ ...model.relationships[0]!, optionality: "optional" }];
    expect(renderMermaid(model)).toContain("customer ||--o{ order");
  });

  it("falls back to a default label when the relationship has no name", () => {
    const model = shopModel();
    model.relationships = [{ ...model.relationships[0]!, name: undefined }];
    expect(renderMermaid(model)).toContain('"relates to"');
  });

  it("skips relationships that reference a missing entity instead of emitting invalid syntax", () => {
    const model = shopModel();
    model.relationships = [{ ...model.relationships[0]!, targetEntityId: "missing" }];
    expect(renderMermaid(model)).not.toContain("undefined");
  });

  it("uses the linked EnumType's name as an enum column's type", () => {
    const model = shopModel();
    model.enums = [{ id: "e1", name: "order status", values: ["pending"] }];
    model.entities[1]!.attributes.push({
      id: "status",
      name: "status",
      logicalName: "Status",
      type: "enum",
      enumId: "e1",
      nullable: false,
      isPrimaryKey: false,
      isForeignKey: false,
      isUnique: false,
    });
    // Whitespace in the enum name still goes through mermaidType's underscore fold.
    expect(renderMermaid(model)).toContain("order_status status");
  });

  it("keeps the bare enum type when enumId doesn't resolve", () => {
    const model = shopModel();
    model.entities[1]!.attributes.push({
      id: "status",
      name: "status",
      logicalName: "Status",
      type: "enum",
      enumId: "missing",
      nullable: false,
      isPrimaryKey: false,
      isForeignKey: false,
      isUnique: false,
    });
    expect(renderMermaid(model)).toContain("enum status");
  });
});

describe("mermaidExporter", () => {
  it("wraps renderMermaid through the Exporter contract", async () => {
    const output = await mermaidExporter.export(shopModel());
    expect(output).toContain("erDiagram");
  });
});
