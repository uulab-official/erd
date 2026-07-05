import type { Entity, Model, Relationship } from "@modelforge/schema-engine";
import type { Exporter } from "@modelforge/sdk";

// These footprint/color constants intentionally mirror packages/canvas's EntityNode.tsx
// (`w-56` = 224px, header ~52px, each attribute row ~28px) and Tailwind's slate/brand
// palette (see apps/web/tailwind.config.js) — this renderer has no dependency on
// packages/canvas (generator only depends on schema-engine/sdk, keeping it usable from
// Node with no DOM), so the visual language is duplicated rather than shared. Getting
// this exactly right matters more here than in ErdCanvas's own SubjectArea bounding-box
// estimate, since this file's output IS what the user sees in the exported SVG/PNG/PDF.
const ENTITY_WIDTH = 224;
const HEADER_HEIGHT = 52;
const ROW_HEIGHT = 28;
const SUBJECT_AREA_PADDING = 32;
const MEMO_WIDTH = 180;
const MEMO_HEIGHT = 120;
const CANVAS_PADDING = 40;

const COLOR = {
  border: "#cbd5e1", // slate-300
  headerBg: "#f8fafc", // slate-50
  headerDivider: "#e2e8f0", // slate-200
  rowDivider: "#f1f5f9", // slate-100
  textPrimary: "#0f172a", // slate-900
  textSecondary: "#334155", // slate-700
  textMuted: "#94a3b8", // slate-400
  physicalName: "#94a3b8", // slate-400
  pkBadgeBg: "#e0e7ff", // brand-100
  pkBadgeText: "#4338ca", // brand-700
  fkBadgeBg: "#f1f5f9", // slate-100
  fkBadgeText: "#475569", // slate-600
  edge: "#94a3b8", // slate-400, matches ErdCanvas's EDGE_COLOR
  edgeLabel: "#475569", // slate-600
  subjectAreaDefault: "#94a3b8",
  memoDefault: "#fde68a", // amber-200, matches MemoNode's DEFAULT_COLOR
};

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function entityHeight(entity: Entity): number {
  return HEADER_HEIGHT + Math.max(entity.attributes.length, 1) * ROW_HEIGHT;
}

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

function entityBox(entity: Entity): Box {
  return { x: entity.ui.x, y: entity.ui.y, width: ENTITY_WIDTH, height: entityHeight(entity) };
}

function renderEntity(model: Model, entity: Entity): string {
  const height = entityHeight(entity);
  const rows =
    entity.attributes.length === 0
      ? `<text x="12" y="${HEADER_HEIGHT + ROW_HEIGHT * 0.65}" font-size="11" fill="${COLOR.textMuted}">No attributes</text>`
      : entity.attributes
          .map((attr, i) => {
            const rowY = HEADER_HEIGHT + i * ROW_HEIGHT;
            const textY = rowY + ROW_HEIGHT * 0.65;
            let badgeX = 12;
            let badges = "";
            if (attr.isPrimaryKey) {
              badges += `<rect x="${badgeX}" y="${rowY + ROW_HEIGHT / 2 - 8}" width="20" height="16" rx="3" fill="${COLOR.pkBadgeBg}" />
                <text x="${badgeX + 10}" y="${textY}" font-size="9" font-weight="600" text-anchor="middle" fill="${COLOR.pkBadgeText}">PK</text>`;
              badgeX += 24;
            }
            if (attr.isForeignKey) {
              badges += `<rect x="${badgeX}" y="${rowY + ROW_HEIGHT / 2 - 8}" width="20" height="16" rx="3" fill="${COLOR.fkBadgeBg}" />
                <text x="${badgeX + 10}" y="${textY}" font-size="9" font-weight="600" text-anchor="middle" fill="${COLOR.fkBadgeText}">FK</text>`;
              badgeX += 24;
            }
            const nameColor = attr.isPrimaryKey ? COLOR.textPrimary : COLOR.textSecondary;
            const nameWeight = attr.isPrimaryKey ? "600" : "400";
            // A bare "enum" tells a diagram viewer nothing about which enum or its
            // allowed values — same class of gap fixed for the code generators/SQL DDL
            // (attribute.enumId resolved against model.enums there too). "?" mirrors
            // EntityNode.tsx's fallback for a dangling enumId.
            const typeLabel =
              attr.type === "enum"
                ? `enum(${model.enums.find((e) => e.id === attr.enumId)?.name ?? "?"})`
                : attr.length
                  ? `${attr.type}(${attr.length})`
                  : attr.type;
            const nullableMark = attr.nullable ? "" : "*";
            return `
              ${i > 0 ? `<line x1="0" y1="${rowY}" x2="${ENTITY_WIDTH}" y2="${rowY}" stroke="${COLOR.rowDivider}" />` : ""}
              ${badges}
              <text x="${badgeX}" y="${textY}" font-size="11" font-weight="${nameWeight}" fill="${nameColor}">${escapeXml(attr.name)}</text>
              <text x="${ENTITY_WIDTH - 10}" y="${textY}" font-size="10" text-anchor="end" fill="${COLOR.textMuted}">${escapeXml(typeLabel)}${nullableMark}</text>`;
          })
          .join("");

  return `
    <g transform="translate(${entity.ui.x}, ${entity.ui.y})">
      <rect width="${ENTITY_WIDTH}" height="${height}" rx="8" fill="white" stroke="${COLOR.border}" />
      <path d="M0,8 a8,8 0 0 1 8,-8 h${ENTITY_WIDTH - 16} a8,8 0 0 1 8,8 v${HEADER_HEIGHT - 8} h${-ENTITY_WIDTH} Z" fill="${COLOR.headerBg}" />
      <line x1="0" y1="${HEADER_HEIGHT}" x2="${ENTITY_WIDTH}" y2="${HEADER_HEIGHT}" stroke="${COLOR.headerDivider}" />
      <text x="12" y="22" font-size="13" font-weight="600" fill="${COLOR.textPrimary}">${escapeXml(entity.logicalName)}</text>
      <text x="12" y="38" font-size="10" font-family="monospace" fill="${COLOR.physicalName}">${escapeXml(entity.physicalName)}</text>
      ${rows}
    </g>`;
}

// Picks which side of each box a relationship line exits/enters from, based on the
// boxes' relative position — the same "whichever direction reads best" idea behind
// EntityNode's four Handles, just decided geometrically instead of by user drag.
function boxEdgePoint(from: Box, to: Box): { x: number; y: number } {
  const fromCenter = { x: from.x + from.width / 2, y: from.y + from.height / 2 };
  const toCenter = { x: to.x + to.width / 2, y: to.y + to.height / 2 };
  const dx = toCenter.x - fromCenter.x;
  const dy = toCenter.y - fromCenter.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? { x: from.x + from.width, y: fromCenter.y } : { x: from.x, y: fromCenter.y };
  }
  return dy >= 0 ? { x: fromCenter.x, y: from.y + from.height } : { x: fromCenter.x, y: from.y };
}

const CARDINALITY_LABEL: Record<Relationship["cardinality"], string> = {
  "one-to-one": "1:1",
  "one-to-many": "1:N",
  "many-to-many": "N:N",
};

function renderRelationships(model: Model): string {
  const byId = new Map(model.entities.map((e) => [e.id, e]));
  return model.relationships
    .map((rel) => {
      const source = byId.get(rel.sourceEntityId);
      const target = byId.get(rel.targetEntityId);
      if (!source || !target) return "";
      const sourceBox = entityBox(source);
      const targetBox = entityBox(target);
      const a = boxEdgePoint(sourceBox, targetBox);
      const b = boxEdgePoint(targetBox, sourceBox);
      const dashArray = rel.kind === "non-identifying" ? ' stroke-dasharray="6 4"' : "";
      const label = rel.name
        ? `${rel.name} (${CARDINALITY_LABEL[rel.cardinality]})`
        : CARDINALITY_LABEL[rel.cardinality];
      const midX = (a.x + b.x) / 2;
      const midY = (a.y + b.y) / 2;
      const labelWidth = label.length * 6 + 8;
      return `
        <line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${COLOR.edge}" stroke-width="1.5"${dashArray} marker-end="url(#arrow)" />
        <rect x="${midX - labelWidth / 2}" y="${midY - 8}" width="${labelWidth}" height="14" fill="white" fill-opacity="0.9" />
        <text x="${midX}" y="${midY + 3}" font-size="10" font-weight="500" text-anchor="middle" fill="${COLOR.edgeLabel}">${escapeXml(label)}</text>`;
    })
    .join("");
}

function subjectAreaFootprint(model: Model, entityIds: string[]): Box | null {
  const byId = new Map(model.entities.map((e) => [e.id, e]));
  const members = entityIds.map((id) => byId.get(id)).filter((e): e is Entity => e !== undefined);
  if (members.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const entity of members) {
    const box = entityBox(entity);
    minX = Math.min(minX, box.x);
    minY = Math.min(minY, box.y);
    maxX = Math.max(maxX, box.x + box.width);
    maxY = Math.max(maxY, box.y + box.height);
  }
  return {
    x: minX - SUBJECT_AREA_PADDING,
    y: minY - SUBJECT_AREA_PADDING,
    width: maxX - minX + SUBJECT_AREA_PADDING * 2,
    height: maxY - minY + SUBJECT_AREA_PADDING * 2,
  };
}

function renderSubjectAreas(model: Model): string {
  return (model.subjectAreas ?? [])
    .map((subjectArea) => {
      const box = subjectAreaFootprint(model, subjectArea.entityIds);
      if (!box) return "";
      const color = subjectArea.color ?? COLOR.subjectAreaDefault;
      return `
        <g>
          <rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" rx="10" fill="${color}" fill-opacity="0.08" stroke="${color}" stroke-width="2" stroke-dasharray="6 4" />
          <path d="M${box.x},${box.y + 22} v-14 a4,4 0 0 1 4,-4 h${Math.min(120, box.width - 8)} v18 Z" fill="${color}" />
          <text x="${box.x + 6}" y="${box.y + 14}" font-size="10" font-weight="600" fill="white">${escapeXml(subjectArea.name)}</text>
        </g>`;
    })
    .join("");
}

// Splits on existing newlines and further wraps long lines at a rough
// characters-per-line budget — SVG has no native text reflow, so this approximates it
// well enough for a short sticky-note memo without pulling in a text-measurement dep.
function wrapText(text: string, charsPerLine: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let remaining = paragraph;
    if (remaining.length === 0) {
      lines.push("");
      continue;
    }
    while (remaining.length > charsPerLine) {
      let breakAt = remaining.lastIndexOf(" ", charsPerLine);
      if (breakAt <= 0) breakAt = charsPerLine;
      lines.push(remaining.slice(0, breakAt));
      remaining = remaining.slice(breakAt).trimStart();
    }
    lines.push(remaining);
  }
  return lines;
}

function renderMemos(model: Model): string {
  return (model.memos ?? [])
    .map((memo) => {
      const color = memo.color ?? COLOR.memoDefault;
      const lines = wrapText(memo.text, 24);
      const textLines = lines
        .map(
          (line, i) =>
            `<text x="10" y="${28 + i * 14}" font-size="11" fill="${COLOR.textPrimary}">${escapeXml(line)}</text>`,
        )
        .join("");
      return `
        <g transform="translate(${memo.x}, ${memo.y})">
          <rect width="${MEMO_WIDTH}" height="${MEMO_HEIGHT}" rx="6" fill="${color}" />
          ${textLines}
        </g>`;
    })
    .join("");
}

// Every box that can appear on the canvas, so the viewBox can be sized to fit all of
// them — Subject Area boxes in particular extend SUBJECT_AREA_PADDING *outward* from
// their member entities, which easily pushes minX/minY negative for anything anchored
// near the canvas origin (the default position for a model's first entity).
function allBoxes(model: Model): Box[] {
  const boxes = model.entities.map(entityBox);
  for (const memo of model.memos ?? []) {
    boxes.push({ x: memo.x, y: memo.y, width: MEMO_WIDTH, height: MEMO_HEIGHT });
  }
  for (const subjectArea of model.subjectAreas ?? []) {
    const box = subjectAreaFootprint(model, subjectArea.entityIds);
    if (box) boxes.push(box);
  }
  return boxes;
}

// Renders the ERD directly from Model, without a browser or React Flow — entity
// positions come straight from ui.x/ui.y. Pure and testable, unlike the PNG/PDF
// exporters (apps/web) which rasterize this output through a DOM canvas. Layer order
// (back to front) matches ErdCanvas: Subject Area boxes, then relationships, then
// Entities/Memos on top.
export function renderSvg(model: Model): string {
  const boxes = allBoxes(model);
  // An empty model (no entities/memos/subject areas) still needs a valid, visible
  // canvas rather than a degenerate 0x0 viewBox.
  const minX = boxes.length > 0 ? Math.min(...boxes.map((b) => b.x)) : 0;
  const minY = boxes.length > 0 ? Math.min(...boxes.map((b) => b.y)) : 0;
  const maxX = boxes.length > 0 ? Math.max(...boxes.map((b) => b.x + b.width)) : 400;
  const maxY = boxes.length > 0 ? Math.max(...boxes.map((b) => b.y + b.height)) : 300;

  const viewMinX = minX - CANVAS_PADDING;
  const viewMinY = minY - CANVAS_PADDING;
  const width = maxX - minX + CANVAS_PADDING * 2;
  const height = maxY - minY + CANVAS_PADDING * 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${viewMinX} ${viewMinY} ${width} ${height}" font-family="sans-serif">
    <defs>
      <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
        <path d="M0,0 L10,5 L0,10 z" fill="${COLOR.edge}" />
      </marker>
    </defs>
    <rect x="${viewMinX}" y="${viewMinY}" width="${width}" height="${height}" fill="white" />
    ${renderSubjectAreas(model)}
    ${renderRelationships(model)}
    ${model.entities.map((entity) => renderEntity(model, entity)).join("")}
    ${renderMemos(model)}
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
