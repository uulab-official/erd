import type { DictionaryEntry, Domain, Model } from "@modelforge/schema-engine";
import { buildOperation, inverseOf, type TypedOperation } from "./operation.js";
import type {
  AddDictionaryEntryPayload,
  CreateDomainPayload,
  DeleteDictionaryEntryPayload,
  DeleteDomainPayload,
  UpdateDictionaryEntryPayload,
  UpdateDomainPayload,
  UpdateNamingRuleSetPayload,
} from "./types.js";

export interface GovernanceOpResult<
  K extends
    | "CreateDomain"
    | "UpdateDomain"
    | "DeleteDomain"
    | "AddDictionaryEntry"
    | "UpdateDictionaryEntry"
    | "DeleteDictionaryEntry"
    | "UpdateNamingRuleSet",
> {
  model: Model;
  operation: TypedOperation<K>;
}

function requireDomain(model: Model, domainId: string): Domain {
  const domain = (model.domains ?? []).find((d) => d.id === domainId);
  if (!domain) throw new Error(`Domain "${domainId}" not found`);
  return domain;
}

function requireDictionaryEntry(model: Model, entryId: string): DictionaryEntry {
  const entry = (model.dictionary ?? []).find((e) => e.id === entryId);
  if (!entry) throw new Error(`Dictionary entry "${entryId}" not found`);
  return entry;
}

export function createDomain(
  model: Model,
  payload: CreateDomainPayload,
  actorId: string,
): GovernanceOpResult<"CreateDomain"> {
  if ((model.domains ?? []).some((d) => d.id === payload.domain.id)) {
    throw new Error(`Domain "${payload.domain.id}" already exists`);
  }
  const nextModel: Model = { ...model, domains: [...(model.domains ?? []), payload.domain] };
  const inverse = inverseOf("DeleteDomain", { domainId: payload.domain.id });
  const operation = buildOperation("CreateDomain", model.id, payload, inverse, actorId);
  return { model: nextModel, operation };
}

// Updates the Domain's own fields only — does NOT fan out to Attributes assigned to it.
// Use updateDomainCascade (transaction.ts) to also re-sync every linked Attribute's
// type/length/scale in one atomically-undoable step.
export function updateDomain(
  model: Model,
  payload: UpdateDomainPayload,
  actorId: string,
): GovernanceOpResult<"UpdateDomain"> {
  const domain = requireDomain(model, payload.domainId);
  const previousChanges: UpdateDomainPayload["changes"] = {};
  for (const key of Object.keys(payload.changes) as (keyof typeof payload.changes)[]) {
    (previousChanges as Record<string, unknown>)[key] = domain[key];
  }
  const nextModel: Model = {
    ...model,
    domains: (model.domains ?? []).map((d) =>
      d.id === domain.id ? { ...d, ...payload.changes } : d,
    ),
  };
  const inverse = inverseOf("UpdateDomain", { domainId: domain.id, changes: previousChanges });
  const operation = buildOperation("UpdateDomain", model.id, payload, inverse, actorId);
  return { model: nextModel, operation };
}

// Throws if any Attribute still references this Domain — use deleteDomainCascade
// (transaction.ts) to unassign them first, mirroring deleteEntity/deleteEntityCascade.
export function deleteDomain(
  model: Model,
  payload: DeleteDomainPayload,
  actorId: string,
): GovernanceOpResult<"DeleteDomain"> {
  const domain = requireDomain(model, payload.domainId);
  const stillReferenced = model.entities.some((e) =>
    e.attributes.some((a) => a.domainId === domain.id),
  );
  if (stillReferenced) {
    throw new Error(`Domain "${domain.id}" is still assigned — use deleteDomainCascade`);
  }
  const nextModel: Model = {
    ...model,
    domains: (model.domains ?? []).filter((d) => d.id !== domain.id),
  };
  const inverse = inverseOf("CreateDomain", { domain });
  const operation = buildOperation("DeleteDomain", model.id, payload, inverse, actorId);
  return { model: nextModel, operation };
}

export function addDictionaryEntry(
  model: Model,
  payload: AddDictionaryEntryPayload,
  actorId: string,
): GovernanceOpResult<"AddDictionaryEntry"> {
  if ((model.dictionary ?? []).some((e) => e.id === payload.entry.id)) {
    throw new Error(`Dictionary entry "${payload.entry.id}" already exists`);
  }
  const nextModel: Model = {
    ...model,
    dictionary: [...(model.dictionary ?? []), payload.entry],
  };
  const inverse = inverseOf("DeleteDictionaryEntry", { entryId: payload.entry.id });
  const operation = buildOperation("AddDictionaryEntry", model.id, payload, inverse, actorId);
  return { model: nextModel, operation };
}

export function updateDictionaryEntry(
  model: Model,
  payload: UpdateDictionaryEntryPayload,
  actorId: string,
): GovernanceOpResult<"UpdateDictionaryEntry"> {
  const entry = requireDictionaryEntry(model, payload.entryId);
  const previousChanges: UpdateDictionaryEntryPayload["changes"] = {};
  for (const key of Object.keys(payload.changes) as (keyof typeof payload.changes)[]) {
    (previousChanges as Record<string, unknown>)[key] = entry[key];
  }
  const nextModel: Model = {
    ...model,
    dictionary: (model.dictionary ?? []).map((e) =>
      e.id === entry.id ? { ...e, ...payload.changes } : e,
    ),
  };
  const inverse = inverseOf("UpdateDictionaryEntry", {
    entryId: entry.id,
    changes: previousChanges,
  });
  const operation = buildOperation("UpdateDictionaryEntry", model.id, payload, inverse, actorId);
  return { model: nextModel, operation };
}

export function deleteDictionaryEntry(
  model: Model,
  payload: DeleteDictionaryEntryPayload,
  actorId: string,
): GovernanceOpResult<"DeleteDictionaryEntry"> {
  const entry = requireDictionaryEntry(model, payload.entryId);
  const nextModel: Model = {
    ...model,
    dictionary: (model.dictionary ?? []).filter((e) => e.id !== entry.id),
  };
  const inverse = inverseOf("AddDictionaryEntry", { entry });
  const operation = buildOperation("DeleteDictionaryEntry", model.id, payload, inverse, actorId);
  return { model: nextModel, operation };
}

// Replaces the whole NamingRuleSet at once — erwin treats it as one settings object per
// project/model rather than a collection of independently-editable fields.
export function updateNamingRuleSet(
  model: Model,
  payload: UpdateNamingRuleSetPayload,
  actorId: string,
): GovernanceOpResult<"UpdateNamingRuleSet"> {
  const previous = model.namingRules;
  const nextModel: Model = { ...model, namingRules: payload.namingRules };
  const inverse = inverseOf("UpdateNamingRuleSet", { namingRules: previous });
  const operation = buildOperation("UpdateNamingRuleSet", model.id, payload, inverse, actorId);
  return { model: nextModel, operation };
}
