import type { Model, NamingRuleSet } from "./types.js";

export interface ValidationIssue {
  severity: "error" | "warning";
  code: string;
  message: string;
  entityId?: string;
  attributeId?: string;
}

// A reasonably complete cross-dialect SQL reserved word list, used as the default until
// a Project's NamingRuleSet.reservedWords (docs/schema-engine.md) is wired through. Callers
// that already have a NamingRuleSet should pass its reservedWords to override this default.
export const DEFAULT_RESERVED_WORDS = [
  "select",
  "insert",
  "update",
  "delete",
  "table",
  "from",
  "where",
  "order",
  "group",
  "join",
  "index",
  "primary",
  "foreign",
  "key",
  "values",
  "into",
  "drop",
  "alter",
  "create",
  "default",
  "null",
  "unique",
  "constraint",
  "references",
  "and",
  "or",
  "not",
  "as",
  "on",
  "in",
  "is",
  "like",
  "between",
  "case",
  "when",
  "then",
  "else",
  "end",
  "union",
  "all",
  "distinct",
  "having",
  "limit",
  "offset",
  "set",
  "user",
  "type",
  "date",
  "time",
  "timestamp",
];

function checkStructural(model: Model): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const entity of model.entities) {
    if (!entity.attributes.some((a) => a.isPrimaryKey)) {
      issues.push({
        severity: "error",
        code: "no-primary-key",
        message: `Entity "${entity.logicalName}" has no primary key attribute.`,
        entityId: entity.id,
      });
    }

    const seen = new Set<string>();
    for (const attr of entity.attributes) {
      if (seen.has(attr.name)) {
        issues.push({
          severity: "error",
          code: "duplicate-attribute-name",
          message: `Duplicate attribute name "${attr.name}" in entity "${entity.logicalName}".`,
          entityId: entity.id,
          attributeId: attr.id,
        });
      }
      seen.add(attr.name);
    }
  }

  const referencedEntityIds = new Set<string>();
  for (const rel of model.relationships) {
    referencedEntityIds.add(rel.sourceEntityId);
    referencedEntityIds.add(rel.targetEntityId);
    if (rel.sourceAttributeIds.length !== rel.targetAttributeIds.length) {
      issues.push({
        severity: "error",
        code: "relationship-attribute-count-mismatch",
        message: `Relationship "${rel.name ?? rel.id}" has mismatched source/target attribute counts.`,
      });
    }
  }

  for (const entity of model.entities) {
    if (!referencedEntityIds.has(entity.id)) {
      issues.push({
        severity: "warning",
        code: "orphan-entity",
        message: `Entity "${entity.logicalName}" has no relationships.`,
        entityId: entity.id,
      });
    }
  }

  return issues;
}

function checkDuplicateIndexes(model: Model): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const entity of model.entities) {
    const seenNames = new Set<string>();
    const seenSignatures = new Map<string, string>();

    for (const index of entity.indexes) {
      if (seenNames.has(index.name)) {
        issues.push({
          severity: "error",
          code: "duplicate-index-name",
          message: `Duplicate index name "${index.name}" on entity "${entity.logicalName}".`,
          entityId: entity.id,
        });
      }
      seenNames.add(index.name);

      const signature = [...index.attributeIds].sort().join(",");
      const existing = seenSignatures.get(signature);
      if (existing && existing !== index.name) {
        issues.push({
          severity: "warning",
          code: "duplicate-index-columns",
          message: `Index "${index.name}" on entity "${entity.logicalName}" covers the same columns as "${existing}".`,
          entityId: entity.id,
        });
      } else {
        seenSignatures.set(signature, index.name);
      }
    }
  }

  return issues;
}

function checkReservedWords(model: Model, reservedWords: string[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const reserved = new Set(reservedWords.map((w) => w.toLowerCase()));

  for (const entity of model.entities) {
    if (reserved.has(entity.physicalName.toLowerCase())) {
      issues.push({
        severity: "error",
        code: "reserved-word",
        message: `Entity physical name "${entity.physicalName}" is a reserved word.`,
        entityId: entity.id,
      });
    }
    for (const attr of entity.attributes) {
      if (reserved.has(attr.name.toLowerCase())) {
        issues.push({
          severity: "error",
          code: "reserved-word",
          message: `Attribute "${attr.name}" on entity "${entity.logicalName}" is a reserved word.`,
          entityId: entity.id,
          attributeId: attr.id,
        });
      }
    }
  }

  return issues;
}

const CASE_PATTERNS: Record<NamingRuleSet["case"], RegExp> = {
  snake: /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/,
  camel: /^[a-z][a-zA-Z0-9]*$/,
  pascal: /^[A-Z][a-zA-Z0-9]*$/,
  upper: /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/,
  lower: /^[a-z][a-z0-9]*$/,
};

// Case rules are inherently fuzzy for single-word names (e.g. "id" satisfies every
// pattern) — this only flags names that clearly violate the configured convention
// (mixed case under snake_case, underscores under camelCase, etc.), not stylistic edge
// cases. `namingRules.case` is a required field on NamingRuleSet, but the whole
// NamingRuleSet is optional on Model — no rules configured means nothing to enforce.
function checkNamingConventions(model: Model): ValidationIssue[] {
  const rules = model.namingRules;
  if (!rules) return [];
  const issues: ValidationIssue[] = [];
  const pattern = CASE_PATTERNS[rules.case];

  function checkAffixes(
    name: string,
    prefix: string | undefined,
    suffix: string | undefined,
    kind: string,
  ): string | undefined {
    if (prefix && !name.startsWith(prefix)) return `should start with prefix "${prefix}"`;
    if (suffix && !name.endsWith(suffix)) return `should end with suffix "${suffix}"`;
    void kind;
    return undefined;
  }

  for (const entity of model.entities) {
    if (!pattern.test(entity.physicalName)) {
      issues.push({
        severity: "warning",
        code: "naming-convention-violation",
        message: `Entity physical name "${entity.physicalName}" doesn't match the configured ${rules.case} case.`,
        entityId: entity.id,
      });
    }
    const affixIssue = checkAffixes(
      entity.physicalName,
      rules.entityPrefix,
      rules.entitySuffix,
      "entity",
    );
    if (affixIssue) {
      issues.push({
        severity: "warning",
        code: "naming-convention-violation",
        message: `Entity physical name "${entity.physicalName}" ${affixIssue}.`,
        entityId: entity.id,
      });
    }

    for (const attr of entity.attributes) {
      if (!pattern.test(attr.name)) {
        issues.push({
          severity: "warning",
          code: "naming-convention-violation",
          message: `Attribute "${attr.name}" on entity "${entity.logicalName}" doesn't match the configured ${rules.case} case.`,
          entityId: entity.id,
          attributeId: attr.id,
        });
      }
      const attrAffixIssue = checkAffixes(
        attr.name,
        rules.attributePrefix,
        rules.attributeSuffix,
        "attribute",
      );
      if (attrAffixIssue) {
        issues.push({
          severity: "warning",
          code: "naming-convention-violation",
          message: `Attribute "${attr.name}" on entity "${entity.logicalName}" ${attrAffixIssue}.`,
          entityId: entity.id,
          attributeId: attr.id,
        });
      }
    }
  }

  return issues;
}

// Suggests the configured abbreviation when a name spells out a word it has a shorthand
// for (e.g. "customer_identifier" when abbreviations maps "identifier" -> "id") — split on
// case/underscore boundaries so this works under any NamingRuleSet.case.
function checkAbbreviations(model: Model): ValidationIssue[] {
  const abbreviations: Record<string, string> = model.namingRules?.abbreviations ?? {};
  if (Object.keys(abbreviations).length === 0) return [];
  const issues: ValidationIssue[] = [];

  function wordsOf(name: string): string[] {
    return name
      .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
      .split(/[_\s]+/)
      .map((w) => w.toLowerCase())
      .filter(Boolean);
  }

  function findViolation(name: string): string | undefined {
    for (const word of wordsOf(name)) {
      const abbreviation = abbreviations[word];
      if (abbreviation) return `should abbreviate "${word}" as "${abbreviation}"`;
    }
    return undefined;
  }

  for (const entity of model.entities) {
    const entityIssue = findViolation(entity.physicalName);
    if (entityIssue) {
      issues.push({
        severity: "warning",
        code: "abbreviation-suggested",
        message: `Entity physical name "${entity.physicalName}" ${entityIssue}.`,
        entityId: entity.id,
      });
    }
    for (const attr of entity.attributes) {
      const attrIssue = findViolation(attr.name);
      if (attrIssue) {
        issues.push({
          severity: "warning",
          code: "abbreviation-suggested",
          message: `Attribute "${attr.name}" on entity "${entity.logicalName}" ${attrIssue}.`,
          entityId: entity.id,
          attributeId: attr.id,
        });
      }
    }
  }

  return issues;
}

// A Domain governs the type/length/scale of every Attribute assigned to it (erwin-style
// "typed attribute group") — flags Attributes that reference a Domain that no longer
// exists, or whose own type/length/scale has drifted from what the Domain currently
// specifies (e.g. someone called ChangeAttributeType directly after assigning a Domain).
function checkDomainDrift(model: Model): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const domainsById = new Map((model.domains ?? []).map((d) => [d.id, d]));

  for (const entity of model.entities) {
    for (const attr of entity.attributes) {
      if (!attr.domainId) continue;
      const domain = domainsById.get(attr.domainId);
      if (!domain) {
        issues.push({
          severity: "error",
          code: "domain-not-found",
          message: `Attribute "${attr.name}" on entity "${entity.logicalName}" references missing domain "${attr.domainId}".`,
          entityId: entity.id,
          attributeId: attr.id,
        });
        continue;
      }
      if (
        attr.type !== domain.type ||
        attr.length !== domain.length ||
        attr.scale !== domain.scale
      ) {
        issues.push({
          severity: "warning",
          code: "domain-drift",
          message: `Attribute "${attr.name}" on entity "${entity.logicalName}" no longer matches its domain "${domain.name}" — re-sync or unassign.`,
          entityId: entity.id,
          attributeId: attr.id,
        });
      }
    }
  }

  return issues;
}

// Identifying relationships form a parent -> child dependency: the child's primary key
// includes the parent's. A cycle in that graph means no entity's PK could ever be
// resolved, so it's a hard error, not just a modeling smell.
function checkCircularIdentifyingRelationships(model: Model): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const edges = new Map<string, string[]>();
  for (const rel of model.relationships) {
    if (rel.kind !== "identifying") continue;
    const children = edges.get(rel.sourceEntityId) ?? [];
    children.push(rel.targetEntityId);
    edges.set(rel.sourceEntityId, children);
  }

  const state = new Map<string, "visiting" | "done">();
  const reportedCycles = new Set<string>();

  function visit(entityId: string, path: string[]): void {
    const status = state.get(entityId);
    if (status === "done") return;
    if (status === "visiting") {
      const cycleStart = path.indexOf(entityId);
      const cycle = [...path.slice(cycleStart), entityId];
      const signature = [...new Set(cycle)].sort().join(",");
      if (!reportedCycles.has(signature)) {
        reportedCycles.add(signature);
        const byId = new Map(model.entities.map((e) => [e.id, e.logicalName]));
        issues.push({
          severity: "error",
          code: "circular-identifying-relationship",
          message: `Circular identifying relationship: ${cycle.map((id) => byId.get(id) ?? id).join(" -> ")}.`,
        });
      }
      return;
    }

    state.set(entityId, "visiting");
    for (const child of edges.get(entityId) ?? []) {
      visit(child, [...path, entityId]);
    }
    state.set(entityId, "done");
  }

  for (const entity of model.entities) {
    if (!state.has(entity.id)) visit(entity.id, []);
  }

  return issues;
}

// Structural invariants from /docs/schema-engine.md. Extend as new rules land.
//
// `reservedWords` is an explicit override for callers that want to check against a
// specific list regardless of the Model's own NamingRuleSet (e.g. testing the reserved-
// word check in isolation). Omit it to check against DEFAULT_RESERVED_WORDS plus
// whatever `model.namingRules.reservedWords` adds on top — the normal, model-aware path.
export function validateModel(model: Model, reservedWords?: string[]): ValidationIssue[] {
  const effectiveReservedWords = reservedWords ?? [
    ...DEFAULT_RESERVED_WORDS,
    ...(model.namingRules?.reservedWords ?? []),
  ];
  return [
    ...checkStructural(model),
    ...checkDuplicateIndexes(model),
    ...checkReservedWords(model, effectiveReservedWords),
    ...checkCircularIdentifyingRelationships(model),
    ...checkNamingConventions(model),
    ...checkAbbreviations(model),
    ...checkDomainDrift(model),
  ];
}
