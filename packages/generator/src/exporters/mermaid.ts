import type { Model, Relationship } from "@modelforge/schema-engine";
import type { Exporter } from "@modelforge/sdk";

// Mermaid attribute types can't contain whitespace — Mermaid Live and most renderers
// only tolerate a single bare word per column, so a length like "string(255)" would
// break parsing. This drops parenthesized length/scale, which Mermaid has no syntax for
// anyway (packages/sdk's Exporter contract is presentation, not round-trip fidelity —
// SQL/Prisma exporters own precise type fidelity).
function mermaidType(type: string): string {
  return type.replace(/\s+/g, "_");
}

function keyMarkers(attr: Model["entities"][number]["attributes"][number]): string {
  const markers: string[] = [];
  if (attr.isPrimaryKey) markers.push("PK");
  if (attr.isForeignKey) markers.push("FK");
  if (attr.isUnique && !attr.isPrimaryKey) markers.push("UK");
  return markers.join(",");
}

// Left symbol is always the "one" side of the relationship; right symbol encodes the
// "many"/"one" side's cardinality plus whether that side is optional (o = zero-or-more/
// zero-or-one, | = one-or-more/exactly-one) per Mermaid's erDiagram crow's-foot spec.
function edgeNotation(rel: Relationship): { left: string; right: string } {
  const rightOptional = rel.optionality === "optional";
  switch (rel.cardinality) {
    case "one-to-one":
      return { left: "||", right: rightOptional ? "o|" : "||" };
    case "many-to-many":
      return { left: rightOptional ? "o{" : "}{", right: rightOptional ? "o{" : "}{" };
    case "one-to-many":
    default:
      return { left: "||", right: rightOptional ? "o{" : "|{" };
  }
}

// Mermaid identifiers can't contain spaces or most punctuation — physicalName is
// already a valid SQL-ish identifier, so it doubles as the diagram node id.
export function renderMermaid(model: Model): string {
  const lines = ["erDiagram"];
  const nameById = new Map(model.entities.map((e) => [e.id, e.physicalName]));

  for (const entity of model.entities) {
    if (entity.attributes.length === 0) {
      lines.push(`  ${entity.physicalName}`);
      continue;
    }
    lines.push(`  ${entity.physicalName} {`);
    for (const attr of entity.attributes) {
      const markers = keyMarkers(attr);
      // An enum-typed attribute shows its linked EnumType's name as the column type —
      // the same convention DBML uses (`order_status status`), and what our own DBML
      // importer maps back to type "enum" + enumId. Parens aren't Mermaid-safe, so no
      // "enum(Name)" wrapper here; a dangling enumId keeps the bare "enum".
      const typeName =
        attr.type === "enum"
          ? (model.enums.find((e) => e.id === attr.enumId)?.name ?? "enum")
          : attr.type;
      lines.push(`    ${mermaidType(typeName)} ${attr.name}${markers ? ` ${markers}` : ""}`);
    }
    lines.push("  }");
  }

  for (const rel of model.relationships) {
    const source = nameById.get(rel.sourceEntityId);
    const target = nameById.get(rel.targetEntityId);
    if (!source || !target) continue; // dangling reference — skip rather than emit invalid syntax
    const { left, right } = edgeNotation(rel);
    const label = rel.name ?? "relates to";
    lines.push(`  ${source} ${left}--${right} ${target} : "${label}"`);
  }

  return lines.join("\n") + "\n";
}

export const mermaidExporter: Exporter = {
  id: "export.mermaid",
  label: "Mermaid",
  targetFormat: "mermaid",
  async export(model: Model) {
    return renderMermaid(model);
  },
};
