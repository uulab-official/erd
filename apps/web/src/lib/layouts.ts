import { gridLayoutEngine, layeredLayoutEngine } from "@modelforge/layout-engine";
import type { LayoutEngine } from "@modelforge/sdk";

// Order = Toolbar menu order; the relationship-aware layout is the sensible default so
// it goes first. Same flat-array idiom as lib/exporters.ts / lib/generators.ts.
export const layoutEngines: LayoutEngine[] = [layeredLayoutEngine, gridLayoutEngine];
