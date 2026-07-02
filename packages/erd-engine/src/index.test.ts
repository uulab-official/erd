import { describe, expect, it } from "vitest";
import { createEmptyModel } from "./index.js";

describe("createEmptyModel", () => {
  it("builds an empty model with the given adapter", () => {
    const model = createEmptyModel("m1", "Shop", "postgresql");
    expect(model.entities).toEqual([]);
    expect(model.adapter).toBe("postgresql");
  });
});
