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
            length: 255,
            nullable: true,
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
        ui: { x: 300, y: 0 },
      },
    ],
  };
}

describe("renderSvg", () => {
  it("renders an <svg> containing every entity's logical and physical name", () => {
    const svg = renderSvg(shopModel());
    expect(svg).toContain("<svg");
    expect(svg).toContain("Customer");
    expect(svg).toContain("customer");
    expect(svg).toContain("Order");
  });

  it("escapes XML-unsafe characters in attribute/entity names", () => {
    const model = shopModel();
    model.entities[0]!.logicalName = 'Cust<omer> & "Co"';
    const svg = renderSvg(model);
    expect(svg).not.toContain("Cust<omer>");
    expect(svg).toContain("Cust&lt;omer&gt;");
  });

  it("renders PK/FK badges and the attribute type with a nullable marker", () => {
    const svg = renderSvg(shopModel());
    expect(svg).toContain(">PK<");
    expect(svg).toContain(">FK<");
    expect(svg).toContain("uuid*"); // id is not nullable
    expect(svg).toContain(">string(255)<"); // email is nullable, no trailing '*'
  });

  it("draws one relationship line with a name+cardinality label and an arrowhead marker", () => {
    const svg = renderSvg(shopModel());
    expect(svg.match(/marker-end="url\(#arrow\)"/g)).toHaveLength(1);
    expect(svg).toContain("places (1:N)");
    expect(svg).toContain('stroke-dasharray="6 4"'); // non-identifying
  });

  it("omits the dash array for identifying relationships", () => {
    const model = shopModel();
    model.relationships[0]!.kind = "identifying";
    const svg = renderSvg(model);
    expect(svg).not.toContain('stroke-dasharray="6 4"');
  });

  it("skips a relationship referencing a missing entity instead of throwing", () => {
    const model = shopModel();
    model.relationships[0]!.targetEntityId = "missing";
    expect(() => renderSvg(model)).not.toThrow();
  });

  it("renders a Subject Area as a dashed box with its name, sized around member entities", () => {
    const model: Model = {
      ...shopModel(),
      subjectAreas: [{ id: "sa1", name: "Sales", entityIds: ["customer"], color: "#ff0000" }],
    };
    const svg = renderSvg(model);
    expect(svg).toContain("Sales");
    expect(svg).toContain('stroke="#ff0000"');
  });

  it("renders a Memo as a colored box containing its (wrapped) text", () => {
    const model: Model = {
      ...shopModel(),
      memos: [{ id: "memo1", text: "Rewritten in the v2 migration", x: 10, y: 10 }],
    };
    const svg = renderSvg(model);
    expect(svg).toContain("Rewritten in the v2");
  });

  it("grows the canvas viewBox to fit memos placed beyond the entities", () => {
    const model: Model = {
      ...shopModel(),
      memos: [{ id: "memo1", text: "far away", x: 5000, y: 5000 }],
    };
    const svg = renderSvg(model);
    const widthMatch = /width="(\d+)"/.exec(svg);
    expect(Number(widthMatch?.[1])).toBeGreaterThan(5000);
  });

  it("shifts the viewBox origin negative so a Subject Area box isn't clipped off the top-left", () => {
    // Subject Area boxes pad outward from their members — an entity anchored at the
    // canvas origin (0,0), the default first-entity position, pushes the box's top-left
    // corner negative. The viewBox must start there too, or the box (and its label)
    // render outside the visible canvas.
    const model: Model = {
      ...shopModel(),
      subjectAreas: [{ id: "sa1", name: "Sales", entityIds: ["customer"] }],
    };
    const svg = renderSvg(model);
    const viewBoxMatch = /viewBox="(-?\d+) (-?\d+) (\d+) (\d+)"/.exec(svg);
    expect(viewBoxMatch).not.toBeNull();
    const [, minX, minY] = viewBoxMatch!.map(Number);
    expect(minX).toBeLessThan(0);
    expect(minY).toBeLessThan(0);
  });

  it("renders a valid, non-degenerate canvas for a model with no entities/memos/subject areas", () => {
    const svg = renderSvg({
      id: "empty",
      name: "Empty",
      adapter: "postgresql",
      entities: [],
      relationships: [],
      views: [],
      sequences: [],
      enums: [],
    });
    const widthMatch = /width="(\d+)"/.exec(svg);
    const heightMatch = /height="(\d+)"/.exec(svg);
    expect(Number(widthMatch?.[1])).toBeGreaterThan(0);
    expect(Number(heightMatch?.[1])).toBeGreaterThan(0);
  });
});

describe("svgExporter", () => {
  it("wraps renderSvg through the Exporter contract", async () => {
    const output = await svgExporter.export(shopModel());
    expect(output).toContain("<svg");
    expect(svgExporter.targetFormat).toBe("svg");
  });
});
