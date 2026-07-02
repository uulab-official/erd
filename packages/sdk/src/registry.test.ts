import { describe, expect, it } from "vitest";
import { createPluginRegistry } from "./plugin.js";
import { createAdapterRegistry } from "./adapter.js";

describe("createPluginRegistry", () => {
  it("registers and retrieves an exporter by id", async () => {
    const registry = createPluginRegistry();
    registry.register({
      type: "exporter",
      impl: {
        id: "export.json",
        label: "JSON",
        targetFormat: "json",
        export: async () => "{}",
      },
    });
    expect(registry.exporters.get("export.json")?.label).toBe("JSON");
  });
});

describe("createAdapterRegistry", () => {
  it("throws for an unregistered adapter kind", () => {
    const registry = createAdapterRegistry();
    expect(() => registry.get("appwrite")).toThrow();
  });
});
