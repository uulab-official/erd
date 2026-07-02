import { describe, expect, it } from "vitest";
import { createInMemoryModelStore } from "./index.js";
import type { Model } from "@modelforge/schema-engine";

describe("createInMemoryModelStore", () => {
  it("round-trips a saved model", async () => {
    const store = createInMemoryModelStore();
    const model: Model = {
      id: "m1",
      name: "Shop",
      adapter: "appwrite",
      entities: [],
      relationships: [],
      views: [],
      sequences: [],
      enums: [],
    };
    await store.save(model);
    expect(await store.load("m1")).toEqual(model);
    expect(await store.load("missing")).toBeNull();
  });
});
