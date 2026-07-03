// DBML (dbdiagram.io) Importer. Line-based parser — DBML's grammar is line-oriented
// enough that a real tokenizer would add a dependency without adding correctness for
// the constructs that matter to a Model (Table/Enum/Ref/indexes). Unsupported blocks
// (Project/TableGroup/Note) are skipped, unknown column settings are ignored, and a
// Ref whose endpoints can't be resolved is dropped rather than failing the import.
import type { Attribute, ColumnType, Entity, Model, Relationship } from "@modelforge/schema-engine";

interface ParsedRef {
  fromTable: string;
  fromColumn: string;
  op: ">" | "<" | "-";
  toTable: string;
  toColumn: string;
  name?: string;
}

const TYPE_MAP: Record<string, ColumnType> = {
  int: "integer",
  integer: "integer",
  smallint: "integer",
  tinyint: "integer",
  mediumint: "integer",
  serial: "integer",
  bigint: "bigint",
  bigserial: "bigint",
  varchar: "string",
  char: "string",
  text: "string",
  string: "string",
  mediumtext: "string",
  longtext: "string",
  bool: "boolean",
  boolean: "boolean",
  timestamp: "datetime",
  timestamptz: "datetime",
  datetime: "datetime",
  date: "datetime",
  time: "datetime",
  json: "json",
  jsonb: "json",
  uuid: "uuid",
  float: "float",
  double: "float",
  real: "float",
  decimal: "float",
  numeric: "float",
  money: "float",
};

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => {
      // '//' inside quotes is content, not a comment — only cut when unquoted.
      let inSingle = false;
      let inDouble = false;
      for (let i = 0; i < line.length - 1; i++) {
        const ch = line[i];
        if (ch === "'" && !inDouble) inSingle = !inSingle;
        else if (ch === '"' && !inSingle) inDouble = !inDouble;
        else if (ch === "/" && line[i + 1] === "/" && !inSingle && !inDouble) {
          return line.slice(0, i);
        }
      }
      return line;
    })
    .join("\n");
}

function unquote(raw: string): string {
  const trimmed = raw.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

// Splits a settings body like `pk, default: 'a,b', ref: > users.id` on commas that
// are not inside quotes.
function splitSettings(body: string): string[] {
  const parts: string[] = [];
  let current = "";
  let inSingle = false;
  let inDouble = false;
  for (const ch of body) {
    if (ch === "'" && !inDouble) inSingle = !inSingle;
    if (ch === '"' && !inSingle) inDouble = !inDouble;
    if (ch === "," && !inSingle && !inDouble) {
      parts.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function parseColumnType(
  raw: string,
  enumNames: Set<string>,
): { type: ColumnType; length?: number; scale?: number } {
  const match = /^([\w.]+)(?:\((\d+)(?:\s*,\s*(\d+))?\))?$/.exec(raw.trim());
  if (!match) return { type: "string" };
  const [, name, lengthRaw, scaleRaw] = match;
  const lower = name!.toLowerCase();
  if (enumNames.has(name!) || enumNames.has(lower)) return { type: "enum" };
  const mapped = TYPE_MAP[lower] ?? "string";
  const length = lengthRaw !== undefined ? Number(lengthRaw) : undefined;
  const scale = scaleRaw !== undefined ? Number(scaleRaw) : undefined;
  // A "(10,2)" suffix on integer types (e.g. MySQL's int(11)) is display width, not
  // precision — only keep it where it means something (string length, decimal scale).
  if (mapped === "string" || mapped === "float") return { type: mapped, length, scale };
  return { type: mapped };
}

function parseDefault(raw: string): Attribute["default"] {
  const value = raw.trim();
  if (/^'.*'$/.test(value) || /^".*"$/.test(value)) return unquote(value);
  if (value === "true") return true;
  if (value === "false") return false;
  if (value === "null") return null;
  const numeric = Number(value);
  if (!Number.isNaN(numeric) && value !== "") return numeric;
  // Function-ish defaults (`now()`, backtick expressions) are kept verbatim as strings.
  return value.replace(/^`|`$/g, "");
}

const REF_ENDPOINT = String.raw`(?:"[^"]+"|\w+)\.(?:"[^"]+"|\w+)`;

function parseRefParts(text: string): ParsedRef | null {
  const match = new RegExp(`^(${REF_ENDPOINT})\\s*([<>-])\\s*(${REF_ENDPOINT})$`).exec(text.trim());
  if (!match) return null;
  const [, left, op, right] = match;
  const [fromTable, fromColumn] = left!.split(".").map(unquote);
  const [toTable, toColumn] = right!.split(".").map(unquote);
  return {
    fromTable: fromTable!,
    fromColumn: fromColumn!,
    op: op as ParsedRef["op"],
    toTable: toTable!,
    toColumn: toColumn!,
  };
}

export function parseDbml(source: string): Model {
  const text = stripComments(source);
  const lines = text.split("\n");

  const enums: Model["enums"] = [];
  const enumNames = new Set<string>();

  // Pass 1: collect enum names so pass 2 can type columns against them.
  for (let i = 0; i < lines.length; i++) {
    const open = /^\s*[Ee]num\s+("?[\w ]+"?)\s*\{/.exec(lines[i]!);
    if (!open) continue;
    const name = unquote(open[1]!);
    const values: string[] = [];
    while (++i < lines.length && !/^\s*\}/.test(lines[i]!)) {
      const value = /^\s*("?[\w-]+"?)/.exec(lines[i]!.trim());
      if (value && lines[i]!.trim()) values.push(unquote(value[1]!));
    }
    enums.push({ id: name, name, values });
    enumNames.add(name);
    enumNames.add(name.toLowerCase());
  }

  const entities: Entity[] = [];
  const refs: ParsedRef[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;

    const standaloneRef = /^\s*[Rr]ef(?:\s+\w+)?\s*:\s*(.+)$/.exec(line);
    if (standaloneRef) {
      const parsed = parseRefParts(standaloneRef[1]!);
      if (parsed) refs.push(parsed);
      continue;
    }

    const tableOpen = /^\s*[Tt]able\s+("[^"]+"|\w+)(?:\s+as\s+("[^"]+"|\w+))?\s*\{/.exec(line);
    if (!tableOpen) continue;

    const physicalName = unquote(tableOpen[1]!);
    const alias = tableOpen[2] ? unquote(tableOpen[2]) : undefined;
    const attributes: Attribute[] = [];
    const indexes: Entity["indexes"] = [];

    while (++i < lines.length && !/^\s*\}/.test(lines[i]!)) {
      const bodyLine = lines[i]!.trim();
      // `Note: '...'` / `Note {` blocks are metadata — but a COLUMN named "note" is
      // legal, so only skip when "note" is followed by a colon or an opening brace.
      if (!bodyLine || /^[Nn]ote\s*[:{]/.test(bodyLine)) continue;

      if (/^[Ii]ndexes\s*\{/.test(bodyLine)) {
        while (++i < lines.length && !/^\s*\}/.test(lines[i]!)) {
          const indexLine = lines[i]!.trim();
          if (!indexLine) continue;
          const indexMatch = /^(?:\(([^)]+)\)|("?[\w]+"?))\s*(?:\[(.+)\])?$/.exec(indexLine);
          if (!indexMatch) continue;
          const columns = (indexMatch[1] ?? indexMatch[2] ?? "")
            .split(",")
            .map((c) => unquote(c))
            .filter(Boolean);
          if (columns.length === 0) continue;
          const settings = indexMatch[3] ? splitSettings(indexMatch[3]) : [];
          const nameSetting = settings
            .find((s) => s.toLowerCase().startsWith("name:"))
            ?.slice("name:".length);
          indexes.push({
            id: `${physicalName}.idx.${columns.join("_")}`,
            name: nameSetting ? unquote(nameSetting) : `idx_${physicalName}_${columns.join("_")}`,
            attributeIds: columns.map((c) => `${physicalName}.${c}`),
            unique: settings.some((s) => s.toLowerCase() === "unique"),
          });
        }
        continue;
      }

      const columnMatch =
        /^("[^"]+"|\w+)\s+([\w.]+(?:\(\d+(?:\s*,\s*\d+)?\))?)\s*(?:\[(.+)\])?$/.exec(bodyLine);
      if (!columnMatch) continue;

      const columnName = unquote(columnMatch[1]!);
      const { type, length, scale } = parseColumnType(columnMatch[2]!, enumNames);
      const settings = columnMatch[3] ? splitSettings(columnMatch[3]) : [];

      const attribute: Attribute = {
        id: `${physicalName}.${columnName}`,
        name: columnName,
        logicalName: columnName,
        type,
        length,
        scale,
        nullable: true,
        isPrimaryKey: false,
        isForeignKey: false,
        isUnique: false,
      };

      for (const setting of settings) {
        const lower = setting.toLowerCase();
        if (lower === "pk" || lower === "primary key") {
          attribute.isPrimaryKey = true;
          attribute.nullable = false;
          attribute.isUnique = true;
        } else if (lower === "unique") attribute.isUnique = true;
        else if (lower === "not null") attribute.nullable = false;
        else if (lower === "null") attribute.nullable = true;
        else if (lower.startsWith("default:")) {
          attribute.default = parseDefault(setting.slice("default:".length));
        } else if (lower.startsWith("note:")) {
          attribute.comment = unquote(setting.slice("note:".length));
        } else if (lower.startsWith("ref:")) {
          const refBody = setting.slice("ref:".length).trim();
          const inline = new RegExp(`^([<>-])\\s*(${REF_ENDPOINT})$`).exec(refBody);
          if (inline) {
            const [toTable, toColumn] = inline[2]!.split(".").map(unquote);
            refs.push({
              fromTable: physicalName,
              fromColumn: columnName,
              op: inline[1] as ParsedRef["op"],
              toTable: toTable!,
              toColumn: toColumn!,
            });
          }
        }
        // increment / other settings: no Model equivalent, ignored.
      }

      attributes.push(attribute);
    }

    entities.push({
      id: physicalName,
      logicalName: alias ?? physicalName,
      physicalName,
      tags: [],
      attributes,
      indexes,
      ui: { x: 0, y: 0 },
    });
  }

  const entityById = new Map(entities.map((e) => [e.id, e]));
  const relationships: Relationship[] = [];

  for (const ref of refs) {
    // `A.x > B.y` = many A rows per B row (A holds the FK). `<` is the mirror image;
    // normalize both so the Relationship always points one-side -> many-side.
    const flipped = ref.op === "<";
    const manyTable = flipped ? ref.toTable : ref.fromTable;
    const manyColumn = flipped ? ref.toColumn : ref.fromColumn;
    const oneTable = flipped ? ref.fromTable : ref.toTable;
    const oneColumn = flipped ? ref.fromColumn : ref.toColumn;

    const manyEntity = entityById.get(manyTable);
    const oneEntity = entityById.get(oneTable);
    if (!manyEntity || !oneEntity) continue;
    const foreignKey = manyEntity.attributes.find((a) => a.name === manyColumn);
    const referenced = oneEntity.attributes.find((a) => a.name === oneColumn);
    if (!foreignKey || !referenced) continue;

    foreignKey.isForeignKey = true;
    if (ref.op === "-") foreignKey.isUnique = true;

    relationships.push({
      id: `${oneTable}.${oneColumn}->${manyTable}.${manyColumn}`,
      name: ref.name,
      sourceEntityId: oneEntity.id,
      targetEntityId: manyEntity.id,
      cardinality: ref.op === "-" ? "one-to-one" : "one-to-many",
      kind: "non-identifying",
      optionality: foreignKey.nullable ? "optional" : "mandatory",
      sourceAttributeIds: [referenced.id],
      targetAttributeIds: [foreignKey.id],
    });
  }

  return {
    id: "imported-dbml",
    name: "Imported DBML",
    adapter: "postgresql",
    entities,
    relationships,
    views: [],
    sequences: [],
    enums,
  };
}
