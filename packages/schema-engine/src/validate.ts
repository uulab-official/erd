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

// Splits a name on case/underscore boundaries into words, preserving each word's original
// casing — shared by checkAbbreviations and checkDictionaryTerms so both work under any
// NamingRuleSet.case. Callers lowercase individual words themselves for case-insensitive
// lookups; checkDictionaryTerms also needs the original casing to compare against
// standardName's exact spelling.
function wordsOf(name: string): string[] {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .split(/[_\s]+/)
    .filter(Boolean);
}

// Runs `findViolation` over every entity/attribute name and reports each hit under the
// given issue code — shared by checkAbbreviations and checkDictionaryTerms, which only
// differ in what counts as a violation.
function checkNamesFor(
  model: Model,
  code: string,
  findViolation: (name: string) => string | undefined,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const entity of model.entities) {
    const entityIssue = findViolation(entity.physicalName);
    if (entityIssue) {
      issues.push({
        severity: "warning",
        code,
        message: `Entity physical name "${entity.physicalName}" ${entityIssue}.`,
        entityId: entity.id,
      });
    }
    for (const attr of entity.attributes) {
      const attrIssue = findViolation(attr.name);
      if (attrIssue) {
        issues.push({
          severity: "warning",
          code,
          message: `Attribute "${attr.name}" on entity "${entity.logicalName}" ${attrIssue}.`,
          entityId: entity.id,
          attributeId: attr.id,
        });
      }
    }
  }
  return issues;
}

// Suggests the configured abbreviation when a name spells out a word it has a shorthand
// for (e.g. "customer_identifier" when abbreviations maps "identifier" -> "id").
function checkAbbreviations(model: Model): ValidationIssue[] {
  const abbreviations: Record<string, string> = model.namingRules?.abbreviations ?? {};
  if (Object.keys(abbreviations).length === 0) return [];

  return checkNamesFor(model, "abbreviation-suggested", (name) => {
    for (const word of wordsOf(name)) {
      const abbreviation = abbreviations[word.toLowerCase()];
      if (abbreviation) return `should abbreviate "${word}" as "${abbreviation}"`;
    }
    return undefined;
  });
}

// Model.dictionary maps a business term to its standardized spelling (e.g. logicalTerm
// "customer" -> standardName "Cust") — the same per-word shorthand shape as
// NamingRuleSet.abbreviations, but this was never actually consulted anywhere: the
// Governance UI lets you create/edit entries, but no validation or generator ever read
// Model.dictionary (checkAbbreviations only reads namingRules.abbreviations). Comparison
// is case-sensitive against standardName, since the whole point is to enforce a specific
// spelling/casing (e.g. "Cust" vs "cust"), not just presence of the right word.
function checkDictionaryTerms(model: Model): ValidationIssue[] {
  const entries = model.dictionary ?? [];
  if (entries.length === 0) return [];
  const standardNameByTerm = new Map(
    entries.map((e) => [e.logicalTerm.toLowerCase(), e.standardName]),
  );

  return checkNamesFor(model, "dictionary-term-suggested", (name) => {
    for (const word of wordsOf(name)) {
      const standardName = standardNameByTerm.get(word.toLowerCase());
      if (standardName && standardName !== word) {
        return `should use the standard term "${standardName}" instead of "${word}"`;
      }
    }
    return undefined;
  });
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

// An attribute typed "enum" with no working enumId link degrades silently everywhere
// downstream (code generators, SQL CHECK/native enum constraints, canvas/SVG diagram
// display all fall back to a generic string/"enum" literal with no diagnostic trail) —
// mirrors checkDomainDrift's "domain-not-found" for the same dangling-reference shape,
// just never extended to cover Enum until now.
function checkEnumIntegrity(model: Model): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const enumsById = new Map(model.enums.map((e) => [e.id, e]));

  for (const entity of model.entities) {
    for (const attr of entity.attributes) {
      if (attr.type !== "enum") continue;
      if (!attr.enumId) {
        issues.push({
          severity: "warning",
          code: "enum-not-linked",
          message: `Attribute "${attr.name}" on entity "${entity.logicalName}" is typed "enum" but isn't linked to an Enum — assign one in Governance, or it will export as a generic string.`,
          entityId: entity.id,
          attributeId: attr.id,
        });
        continue;
      }
      if (!enumsById.has(attr.enumId)) {
        issues.push({
          severity: "error",
          code: "enum-not-found",
          message: `Attribute "${attr.name}" on entity "${entity.logicalName}" references missing enum "${attr.enumId}".`,
          entityId: entity.id,
          attributeId: attr.id,
        });
      }
    }
  }

  return issues;
}

// Domain/Enum/SubjectArea names have no Operation-level duplicate check (createDomain/
// createEnum/createSubjectArea only reject a duplicate id, never a duplicate name), so a
// Model that arrived via import/restore/manual edit could carry two Domains, Enums, or
// Subject Areas sharing a name with no diagnostic trail — confusing in the Governance UI
// (which lists them by name) and, for Enum specifically, ambiguous for any consumer that
// looks Enums up by name rather than id.
function checkDuplicateGovernanceNames(model: Model): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const seenDomainNames = new Set<string>();
  for (const domain of model.domains ?? []) {
    if (seenDomainNames.has(domain.name)) {
      issues.push({
        severity: "error",
        code: "duplicate-domain-name",
        message: `Duplicate domain name "${domain.name}".`,
      });
    }
    seenDomainNames.add(domain.name);
  }

  const seenEnumNames = new Set<string>();
  for (const enumType of model.enums) {
    if (seenEnumNames.has(enumType.name)) {
      issues.push({
        severity: "error",
        code: "duplicate-enum-name",
        message: `Duplicate enum name "${enumType.name}".`,
      });
    }
    seenEnumNames.add(enumType.name);
  }

  const seenSubjectAreaNames = new Set<string>();
  for (const subjectArea of model.subjectAreas ?? []) {
    if (seenSubjectAreaNames.has(subjectArea.name)) {
      issues.push({
        severity: "error",
        code: "duplicate-subject-area-name",
        message: `Duplicate subject area name "${subjectArea.name}".`,
      });
    }
    seenSubjectAreaNames.add(subjectArea.name);
  }

  return issues;
}

// checkDictionaryTerms (above) looks up a word's standard spelling via
// `new Map(entries.map((e) => [e.logicalTerm.toLowerCase(), e.standardName]))` — two
// DictionaryEntry objects sharing a logicalTerm (case-insensitively, matching that Map's
// key) silently collapse to whichever one iterates last, with the other's standardName
// dropped and no diagnostic. addDictionaryEntry/updateDictionaryEntry now reject this at
// the Operation layer, but a Model that arrived a different way (import/restore) could
// still carry the collision.
function checkDuplicateDictionaryTerms(model: Model): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seenTerms = new Set<string>();

  for (const entry of model.dictionary ?? []) {
    const key = entry.logicalTerm.toLowerCase();
    if (seenTerms.has(key)) {
      issues.push({
        severity: "error",
        code: "duplicate-dictionary-term",
        message: `Duplicate dictionary term "${entry.logicalTerm}".`,
      });
    }
    seenTerms.add(key);
  }

  return issues;
}

// Sequence/View names have no Operation-level duplicate check until now (mirrors the
// "created via Operation guard, but nothing re-checks a Model that arrived a different
// way" gap that domain/enum integrity checks above close) — two Sequences or Views
// sharing a name would emit two colliding `CREATE SEQUENCE`/`CREATE VIEW` statements in
// the SQL adapter. Also flags a View with no `sql` — the SQL adapter's toNativeSchema
// silently excludes it from Deploy Plan, so a blanked-out View disappears with no trail.
function checkDatabaseObjects(model: Model): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const seenSequenceNames = new Set<string>();
  for (const sequence of model.sequences) {
    if (seenSequenceNames.has(sequence.name)) {
      issues.push({
        severity: "error",
        code: "duplicate-sequence-name",
        message: `Duplicate sequence name "${sequence.name}".`,
      });
    }
    seenSequenceNames.add(sequence.name);
  }

  const seenViewNames = new Set<string>();
  for (const view of model.views) {
    if (seenViewNames.has(view.name)) {
      issues.push({
        severity: "error",
        code: "duplicate-view-name",
        message: `Duplicate view name "${view.name}".`,
      });
    }
    seenViewNames.add(view.name);

    if (!view.sql?.trim()) {
      issues.push({
        severity: "warning",
        code: "view-missing-sql",
        message: `View "${view.name}" has no SQL — it will be skipped when deploying to a SQL adapter.`,
      });
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

// changeAttributeType has no guard against retyping an attribute already used as a
// relationship's source/target (unlike removeAttribute's hard block on deleting one) —
// erwin-class tools let you freely edit types and only flag the resulting mismatch, since
// retyping isn't destructive the way deleting the attribute out from under the
// relationship would be. Without this check, a PK/FK type drift was invisible until an
// actual SQL deploy attempt failed outright (most databases reject a FOREIGN KEY whose
// column types don't match) — this surfaces it immediately in the Validation tab instead.
function checkRelationshipAttributeTypeMismatch(model: Model): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const entitiesById = new Map(model.entities.map((e) => [e.id, e]));
  for (const rel of model.relationships) {
    if (rel.sourceAttributeIds.length !== rel.targetAttributeIds.length) continue;
    const source = entitiesById.get(rel.sourceEntityId);
    const target = entitiesById.get(rel.targetEntityId);
    if (!source || !target) continue;
    for (let i = 0; i < rel.sourceAttributeIds.length; i++) {
      const sourceAttr = source.attributes.find((a) => a.id === rel.sourceAttributeIds[i]);
      const targetAttr = target.attributes.find((a) => a.id === rel.targetAttributeIds[i]);
      if (!sourceAttr || !targetAttr || sourceAttr.type === targetAttr.type) continue;
      issues.push({
        severity: "error",
        code: "relationship-attribute-type-mismatch",
        message: `Relationship "${rel.name ?? rel.id}" links "${source.logicalName}.${sourceAttr.name}" (${sourceAttr.type}) to "${target.logicalName}.${targetAttr.name}" (${targetAttr.type}) — a foreign key requires matching column types.`,
        entityId: target.id,
        attributeId: targetAttr.id,
      });
    }
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
    ...checkRelationshipAttributeTypeMismatch(model),
    ...checkNamingConventions(model),
    ...checkAbbreviations(model),
    ...checkDictionaryTerms(model),
    ...checkDomainDrift(model),
    ...checkEnumIntegrity(model),
    ...checkDuplicateGovernanceNames(model),
    ...checkDuplicateDictionaryTerms(model),
    ...checkDatabaseObjects(model),
  ];
}
