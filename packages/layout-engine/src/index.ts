// LayoutEngine implementations (ELK.js/Dagre backed). See /docs/plugins.md.
import type { Model } from "@modelforge/schema-engine";
import type { LayoutEngine } from "@modelforge/sdk";

// Placeholder grid layout so the interface has one concrete, testable implementation
// until the ELK.js/Dagre-backed engines land.
export const gridLayoutEngine: LayoutEngine = {
  id: "layout.grid",
  label: "Grid",
  algorithm: "grid",
  async layout(model: Model) {
    const columns = Math.ceil(Math.sqrt(model.entities.length));
    const spacing = 280;
    const positions: Record<string, { x: number; y: number }> = {};
    model.entities.forEach((entity, index) => {
      positions[entity.id] = {
        x: (index % columns) * spacing,
        y: Math.floor(index / columns) * spacing,
      };
    });
    return positions;
  },
};
