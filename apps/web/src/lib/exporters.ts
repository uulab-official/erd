import { jsPDF } from "jspdf";
import {
  jsonExporter,
  markdownExporter,
  mermaidExporter,
  mysqlExporter,
  renderSvg,
  sqlExporter,
  sqliteExporter,
  svgExporter,
} from "@modelforge/generator";
import type { Model } from "@modelforge/schema-engine";
import type { Exporter } from "@modelforge/sdk";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to rasterize the exported SVG"));
    image.src = src;
  });
}

// PNG/PDF require rasterizing through a DOM <canvas> — the only browser-dependent
// step in the export pipeline. Everything else (renderSvg, markdown, json) is a pure
// function that runs anywhere, including in packages/generator's own test suite.
async function svgToPngBlob(svg: string): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const image = await loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable");
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("canvas.toBlob failed"))),
        "image/png",
      );
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read PNG blob"));
    reader.readAsDataURL(blob);
  });
}

export const pngExporter: Exporter = {
  id: "export.png",
  label: "PNG",
  targetFormat: "png",
  async export(model: Model) {
    return svgToPngBlob(renderSvg(model));
  },
};

export const pdfExporter: Exporter = {
  id: "export.pdf",
  label: "PDF",
  targetFormat: "pdf",
  async export(model: Model) {
    const pngBlob = await svgToPngBlob(renderSvg(model));
    const dataUrl = await blobToDataUrl(pngBlob);
    const image = await loadImage(dataUrl);
    const pdf = new jsPDF({
      orientation: image.width > image.height ? "landscape" : "portrait",
      unit: "pt",
      format: [image.width, image.height],
    });
    pdf.addImage(dataUrl, "PNG", 0, 0, image.width, image.height);
    return pdf.output("blob");
  },
};

export const exporters: Exporter[] = [
  svgExporter,
  pngExporter,
  pdfExporter,
  markdownExporter,
  mermaidExporter,
  jsonExporter,
  sqlExporter,
  mysqlExporter,
  sqliteExporter,
];

const EXTENSION_BY_FORMAT: Record<string, string> = {
  svg: "svg",
  png: "png",
  pdf: "pdf",
  markdown: "md",
  mermaid: "mmd",
  json: "json",
  sql: "sql",
};

export async function downloadExport(exporter: Exporter, model: Model): Promise<void> {
  const output = await exporter.export(model);
  const blob = output instanceof Blob ? output : new Blob([output], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const extension = EXTENSION_BY_FORMAT[exporter.targetFormat] ?? "txt";
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${model.name}.${extension}`;
  anchor.click();
  URL.revokeObjectURL(url);
}
