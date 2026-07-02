import { describe, expect, it } from "vitest";
import { createAdapterRegistry } from "./index.js";

describe("deploy-engine", () => {
  it("exposes a working adapter registry", () => {
    const registry = createAdapterRegistry();
    expect(registry.list()).toEqual([]);
  });
});
