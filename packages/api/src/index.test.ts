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

  it("lists saved models as summaries and removes them", async () => {
    const store = createInMemoryModelStore();
    const shop: Model = {
      id: "m1",
      name: "Shop",
      adapter: "appwrite",
      entities: [],
      relationships: [],
      views: [],
      sequences: [],
      enums: [],
    };
    const blog: Model = { ...shop, id: "m2", name: "Blog" };
    await store.save(shop);
    await store.save(blog);

    expect(await store.list()).toEqual([
      { id: "m2", name: "Blog", updatedAt: expect.any(String) },
      { id: "m1", name: "Shop", updatedAt: expect.any(String) },
    ]);

    await store.remove("m1");
    expect(await store.list()).toEqual([{ id: "m2", name: "Blog", updatedAt: expect.any(String) }]);
    expect(await store.load("m1")).toBeNull();
  });
});
