import { prismaGenerator } from "@modelforge/generator";
import type { Model } from "@modelforge/schema-engine";
import type { CodeGenerator } from "@modelforge/sdk";

export const generators: CodeGenerator[] = [prismaGenerator];

// CodeGenerators can emit multiple files (docs/plugins.md); download each one. Browsers
// may prompt before allowing more than one simultaneous download — acceptable for now
// since every generator currently registered emits exactly one file.
export async function downloadGenerated(generator: CodeGenerator, model: Model): Promise<void> {
  const files = await generator.generate(model);
  for (const file of files) {
    const blob = new Blob([file.content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = file.path;
    anchor.click();
    URL.revokeObjectURL(url);
  }
}
