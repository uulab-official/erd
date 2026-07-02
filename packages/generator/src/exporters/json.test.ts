import { describe, expect, it } from "vitest";
import { jsonExporter } from "./json.js";
import type { Model } from "@modelforge/schema-engine";

describe("jsonExporter", () => {
  it("serializes the model as pretty JSON", async () => {
    const model: Model = {
      id: "m1",
      name: "Shop",
      adapter: "postgresql",
      entities: [],
      relationships: [],
      views: [],
      sequences: [],
      enums: [],
    };
    const output = (await jsonExporter.export(model)) as string;
    expect(JSON.parse(output)).toEqual(model);
    expect(output).toContain("\n");
  });
});
