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

  it("saves, lists, gets, and deletes versions independently per model", async () => {
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
    await store.save(shop);
    const v1Snapshot = { ...shop, name: "Shop v1" };
    await store.saveVersion("m1", {
      id: "v1",
      label: "First cut",
      createdAt: "t1",
      snapshot: v1Snapshot,
    });
    const v2Snapshot = { ...shop, name: "Shop v2" };
    await store.saveVersion("m1", {
      id: "v2",
      label: "Added orders",
      createdAt: "t2",
      snapshot: v2Snapshot,
    });

    expect(await store.listVersions("m1")).toEqual([
      { id: "v1", label: "First cut", createdAt: "t1" },
      { id: "v2", label: "Added orders", createdAt: "t2" },
    ]);
    expect(await store.getVersion("m1", "v1")).toEqual(v1Snapshot);
    expect(await store.getVersion("m1", "missing")).toBeNull();
    expect(await store.listVersions("m2")).toEqual([]);

    await store.deleteVersion("m1", "v1");
    expect(await store.listVersions("m1")).toEqual([
      { id: "v2", label: "Added orders", createdAt: "t2" },
    ]);
  });
});
