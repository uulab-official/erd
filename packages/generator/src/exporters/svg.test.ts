import { describe, expect, it } from "vitest";
import { renderSvg, svgExporter } from "./svg.js";
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
        ui: { x: 300, y: 0 },
      },
    ],
  };
}

describe("renderSvg", () => {
  it("renders an <svg> containing every entity's logical name", () => {
    const svg = renderSvg(shopModel());
    expect(svg).toContain("<svg");
    expect(svg).toContain("Customer");
    expect(svg).toContain("Order");
  });

  it("escapes XML-unsafe characters in attribute/entity names", () => {
    const model = shopModel();
    model.entities[0]!.logicalName = 'Cust<omer> & "Co"';
    const svg = renderSvg(model);
    expect(svg).not.toContain("Cust<omer>");
    expect(svg).toContain("Cust&lt;omer&gt;");
  });

  it("draws one relationship line, distinct from entity header dividers", () => {
    const svg = renderSvg(shopModel());
    expect(svg.match(/stroke="#6b7280"/g)).toHaveLength(1);
  });
});

describe("svgExporter", () => {
  it("wraps renderSvg through the Exporter contract", async () => {
    const output = await svgExporter.export(shopModel());
    expect(output).toContain("<svg");
    expect(svgExporter.targetFormat).toBe("svg");
  });
});
