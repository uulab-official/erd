import type { Model } from "@modelforge/schema-engine";
import type { Exporter } from "@modelforge/sdk";

// A data-dictionary style Markdown document: one table per Entity, plus a
// Relationships summary. Useful for docs and PR review, independent of any
// diagramming tool.
export function renderMarkdown(model: Model): string {
  const lines: string[] = [`# ${model.name}`, ""];

  for (const entity of model.entities) {
    lines.push(`## ${entity.logicalName} (\`${entity.physicalName}\`)`);
    if (entity.description) lines.push("", entity.description);
    lines.push("", "| Attribute | Type | Nullable | Key | Comment |", "|---|---|---|---|---|");
    for (const attr of entity.attributes) {
      const key = attr.isPrimaryKey ? "PK" : attr.isForeignKey ? "FK" : "";
      const type = attr.length ? `${attr.type}(${attr.length})` : attr.type;
      lines.push(
        `| ${attr.name} | ${type} | ${attr.nullable ? "yes" : "no"} | ${key} | ${attr.comment ?? ""} |`,
      );
    }
    lines.push("");
  }

  if (model.relationships.length > 0) {
    lines.push(
      "## Relationships",
      "",
      "| Source | Target | Cardinality | Kind |",
      "|---|---|---|---|",
    );
    const byId = new Map(model.entities.map((e) => [e.id, e.logicalName]));
    for (const rel of model.relationships) {
      lines.push(
        `| ${byId.get(rel.sourceEntityId) ?? rel.sourceEntityId} | ${byId.get(rel.targetEntityId) ?? rel.targetEntityId} | ${rel.cardinality} | ${rel.kind} |`,
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}

export const markdownExporter: Exporter = {
  id: "export.markdown",
  label: "Markdown",
  targetFormat: "markdown",
  async export(model: Model) {
    return renderMarkdown(model);
  },
};
