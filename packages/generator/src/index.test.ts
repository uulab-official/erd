import { describe, expect, it } from "vitest";
import { jsonSchemaExportGenerator } from "./index.js";
import type { Model } from "@modelforge/schema-engine";

describe("jsonSchemaExportGenerator", () => {
  it("emits one file named after the model", async () => {
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
    const files = await jsonSchemaExportGenerator.generate(model);
    expect(files).toHaveLength(1);
    expect(files[0]?.path).toBe("Shop.schema.json");
  });
});
