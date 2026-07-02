import { describe, expect, it } from "vitest";
import { parseMermaidErDiagram } from "./index.js";

describe("parseMermaidErDiagram", () => {
  it("extracts entities and a relationship from a single line", () => {
    const model = parseMermaidErDiagram("Customer ||--o{ Order : places");
    expect(model.entities.map((e) => e.id)).toEqual(["Customer", "Order"]);
    expect(model.relationships).toHaveLength(1);
    expect(model.relationships[0]?.name).toBe("places");
  });
});
