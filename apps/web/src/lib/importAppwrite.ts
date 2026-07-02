import { fromNativeSchema, parseAppwriteJson } from "@modelforge/deploy-engine";
import type { Model } from "@modelforge/schema-engine";

// Reads an Appwrite CLI appwrite.json export (from `appwrite pull collections`) and
// converts it into a Model. This is the browser-safe half of "Appwrite Import" — reading
// live Collections over the admin API needs a server-side connection, tracked separately
// in ROADMAP.md.
export async function importAppwriteJsonFile(file: File): Promise<Model> {
  const text = await file.text();
  const schema = parseAppwriteJson(text);
  return fromNativeSchema(schema);
}
