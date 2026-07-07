import { gridLayoutEngine, layeredLayoutEngine } from "@modelforge/layout-engine";
import type { LayoutEngine } from "@modelforge/sdk";
import { pluginRegistry } from "./pluginRegistry.js";

// Order = Toolbar menu order; the relationship-aware layout is the sensible default so
// it goes first.
for (const engine of [layeredLayoutEngine, gridLayoutEngine]) {
  pluginRegistry.register({ type: "layout-engine", impl: engine });
}
export const layoutEngines: LayoutEngine[] = [...pluginRegistry.layoutEngines.values()];
