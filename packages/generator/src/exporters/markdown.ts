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
      // enum(Name) instead of the bare "enum" literal — a data dictionary is exactly
      // where a reader needs to know which enum constrains the column (its values are
      // listed in the "## Enums" section below).
      const type =
        attr.type === "enum"
          ? `enum(${model.enums.find((e) => e.id === attr.enumId)?.name ?? "?"})`
          : attr.length
            ? `${attr.type}(${attr.length})`
            : attr.type;
      lines.push(
        `| ${attr.name} | ${type} | ${attr.nullable ? "yes" : "no"} | ${key} | ${attr.comment ?? ""} |`,
      );
    }
    lines.push("");
  }

  if (model.enums.length > 0) {
    lines.push("## Enums", "", "| Enum | Values |", "|---|---|");
    for (const enumType of model.enums) {
      lines.push(`| ${enumType.name} | ${enumType.values.join(", ")} |`);
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

  if (model.sequences.length > 0) {
    lines.push("## Sequences", "", "| Sequence | Start | Increment |", "|---|---|---|");
    for (const sequence of model.sequences) {
      lines.push(`| ${sequence.name} | ${sequence.start} | ${sequence.increment} |`);
    }
    lines.push("");
  }

  if (model.views.length > 0) {
    lines.push("## Views", "");
    for (const view of model.views) {
      lines.push(`### ${view.name}`, "", "```sql", view.sql ?? "", "```", "");
    }
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
