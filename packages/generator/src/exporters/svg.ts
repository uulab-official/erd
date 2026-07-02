import type { Entity, Model } from "@modelforge/schema-engine";
import type { Exporter } from "@modelforge/sdk";

const ENTITY_WIDTH = 200;
const ROW_HEIGHT = 20;
const HEADER_HEIGHT = 28;
const PADDING = 40;

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function entityHeight(entity: Entity): number {
  return HEADER_HEIGHT + Math.max(entity.attributes.length, 1) * ROW_HEIGHT;
}

function renderEntity(entity: Entity): string {
  const height = entityHeight(entity);
  const rows = entity.attributes
    .map((attr, i) => {
      const y = HEADER_HEIGHT + i * ROW_HEIGHT + ROW_HEIGHT * 0.7;
      const marker = attr.isPrimaryKey ? "🔑 " : attr.isForeignKey ? "→ " : "";
      return `<text x="8" y="${y}" font-size="12">${escapeXml(marker + attr.name)}</text>`;
    })
    .join("");

  return `
    <g transform="translate(${entity.ui.x}, ${entity.ui.y})">
      <rect width="${ENTITY_WIDTH}" height="${height}" fill="white" stroke="#333" stroke-width="1.5" />
      <rect width="${ENTITY_WIDTH}" height="${HEADER_HEIGHT}" fill="${entity.color ?? "#e5e7eb"}" stroke="#333" stroke-width="1.5" />
      <text x="8" y="${HEADER_HEIGHT / 2 + 5}" font-size="14" font-weight="bold">${escapeXml(entity.logicalName)}</text>
      <line x1="0" y1="${HEADER_HEIGHT}" x2="${ENTITY_WIDTH}" y2="${HEADER_HEIGHT}" stroke="#333" />
      ${rows}
    </g>`;
}

function entityCenter(entity: Entity): { x: number; y: number } {
  return {
    x: entity.ui.x + ENTITY_WIDTH / 2,
    y: entity.ui.y + entityHeight(entity) / 2,
  };
}

function renderRelationships(model: Model): string {
  const byId = new Map(model.entities.map((e) => [e.id, e]));
  return model.relationships
    .map((rel) => {
      const source = byId.get(rel.sourceEntityId);
      const target = byId.get(rel.targetEntityId);
      if (!source || !target) return "";
      const a = entityCenter(source);
      const b = entityCenter(target);
      return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#6b7280" stroke-width="1.5" />`;
    })
    .join("");
}

// Renders the ERD directly from Model, without a browser or React Flow — entity
// positions come straight from ui.x/ui.y. Pure and testable, unlike the PNG/PDF
// exporters (apps/web) which rasterize this output through a DOM canvas.
export function renderSvg(model: Model): string {
  const maxX = Math.max(0, ...model.entities.map((e) => e.ui.x + ENTITY_WIDTH));
  const maxY = Math.max(0, ...model.entities.map((e) => e.ui.y + entityHeight(e)));
  const width = maxX + PADDING;
  const height = maxY + PADDING;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="sans-serif">
    ${renderRelationships(model)}
    ${model.entities.map(renderEntity).join("")}
  </svg>`;
}

export const svgExporter: Exporter = {
  id: "export.svg",
  label: "SVG",
  targetFormat: "svg",
  async export(model: Model) {
    return renderSvg(model);
  },
};
