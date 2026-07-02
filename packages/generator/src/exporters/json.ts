import type { Model } from "@modelforge/schema-engine";
import type { Exporter } from "@modelforge/sdk";

export const jsonExporter: Exporter = {
  id: "export.json",
  label: "JSON",
  targetFormat: "json",
  async export(model: Model) {
    return JSON.stringify(model, null, 2);
  },
};
