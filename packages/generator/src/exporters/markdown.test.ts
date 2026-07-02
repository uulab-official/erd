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
});

describe("markdownExporter", () => {
  it("wraps renderMarkdown through the Exporter contract", async () => {
    const output = await markdownExporter.export(shopModel());
    expect(output).toContain("# Shop");
  });
});
