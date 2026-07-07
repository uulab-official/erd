import { describe, expect, it } from "vitest";
import { renderMarkdown, markdownExporter } from "./markdown.js";
import type { Model } from "@modelforge/schema-engine";

function shopModel(): Model {
  return {
    id: "m1",
    name: "Shop",
    adapter: "postgresql",
    relationships: [
      {
        id: "r1",
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
        ],
        indexes: [],
        ui: { x: 0, y: 0 },
      },
      {
        id: "order",
        logicalName: "Order",
        physicalName: "order",
        tags: [],
        attributes: [],
        indexes: [],
        ui: { x: 0, y: 0 },
      },
    ],
  };
}

describe("renderMarkdown", () => {
  it("includes a heading and attribute table per entity", () => {
    const md = renderMarkdown(shopModel());
    expect(md).toContain("## Customer (`customer`)");
    expect(md).toContain("| id | uuid | no | PK |");
  });

  it("includes a relationships table when relationships exist", () => {
    const md = renderMarkdown(shopModel());
    expect(md).toContain("## Relationships");
    expect(md).toContain("| Customer | Order | one-to-many | non-identifying |");
  });

  it("omits the relationships section when there are none", () => {
    const model = shopModel();
    model.relationships = [];
    expect(renderMarkdown(model)).not.toContain("## Relationships");
  });

  function modelWithEnumAttribute(): Model {
    const model = shopModel();
    model.enums = [{ id: "e1", name: "OrderStatus", values: ["pending", "shipped"] }];
    model.entities[0]!.attributes.push({
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
    return model;
  }

  it("shows the linked enum's name in the Type column and lists its values in an Enums section", () => {
    const md = renderMarkdown(modelWithEnumAttribute());
    expect(md).toContain("| status | enum(OrderStatus) | no |  |");
    expect(md).toContain("## Enums");
    expect(md).toContain("| OrderStatus | pending, shipped |");
  });

  it("falls back to enum(?) when enumId doesn't resolve, and omits the Enums section when Model.enums is empty", () => {
    const model = modelWithEnumAttribute();
    model.enums = [];
    const md = renderMarkdown(model);
    expect(md).toContain("| status | enum(?) |");
    expect(md).not.toContain("## Enums");
  });

  it("includes a Sequences table when sequences exist", () => {
    const model = shopModel();
    model.sequences = [{ id: "s1", name: "order_seq", start: 1, increment: 1 }];
    const md = renderMarkdown(model);
    expect(md).toContain("## Sequences");
    expect(md).toContain("| order_seq | 1 | 1 |");
  });

  it("includes a Views section with a fenced sql block when views exist", () => {
    const model = shopModel();
    model.views = [{ id: "v1", name: "active_orders", sql: "SELECT * FROM orders" }];
    const md = renderMarkdown(model);
    expect(md).toContain("## Views");
    expect(md).toContain("### active_orders");
    expect(md).toContain("```sql\nSELECT * FROM orders\n```");
  });

  it("omits Sequences/Views sections when there are none", () => {
    const md = renderMarkdown(shopModel());
    expect(md).not.toContain("## Sequences");
    expect(md).not.toContain("## Views");
  });
});

describe("markdownExporter", () => {
  it("wraps renderMarkdown through the Exporter contract", async () => {
    const output = await markdownExporter.export(shopModel());
    expect(output).toContain("# Shop");
  });
});
