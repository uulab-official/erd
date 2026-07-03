import { create } from "zustand";
import type { VersionSummary } from "@modelforge/api";
import type { DictionaryEntry, Domain, Model, NamingRuleSet } from "@modelforge/schema-engine";
import { validateModel, type ValidationIssue } from "@modelforge/schema-engine";
import {
  addDictionaryEntry as addDictionaryEntryOp,
  assignDomain as assignDomainOp,
  connectEntitiesCascade,
  createDomain as createDomainOp,
  createEntity,
  deleteDictionaryEntry as deleteDictionaryEntryOp,
  deleteDomainCascade,
  deleteEntityCascade,
  describeHistoryEntry,
  OperationHistory,
  unassignDomain as unassignDomainOp,
  updateDictionaryEntry as updateDictionaryEntryOp,
  updateDomainCascade,
  updateNamingRuleSet as updateNamingRuleSetOp,
  type UpdateDictionaryEntryPayload,
  type UpdateDomainPayload,
} from "@modelforge/erd-engine";
import { getModelStore } from "../lib/appwrite.js";

const ACTOR_ID = "local-user";
const ENTITY_SPACING = 260;

function emptyModel(id: string, name: string): Model {
  return {
    id,
    name,
    adapter: "appwrite",
    entities: [],
    relationships: [],
    views: [],
    sequences: [],
    enums: [],
  };
}

function toPhysicalName(logicalName: string): string {
  return logicalName.trim().toLowerCase().replace(/\s+/g, "_") || "entity";
}

interface EditorState {
  model: Model;
  // The last loaded-from/saved-to snapshot — the Diff tab compares the live model
  // against this, mirroring "현재 모델 ↔ 운영 DB 비교" in docs/operations.md. A brand
  // new, never-saved project's baseline is its own starting (empty) model.
  savedModel: Model;
  issues: ValidationIssue[];
  canUndo: boolean;
  canRedo: boolean;
  // Oldest first, mirroring OperationHistory.entries() — the History tab renders labels
  // via describeHistoryEntry() at the time each entry is pushed/popped.
  historyLog: string[];
  saving: boolean;
  loading: boolean;
  addEntity(logicalName: string): void;
  removeEntity(entityId: string): void;
  // Draws a Relationship from a Canvas drag between two entities' Handles — creates a
  // foreign key Attribute on the target (mirroring the source's primary key) and the
  // Relationship together. Throws if the source has no single-column primary key to
  // reference; callers (the Canvas) are expected to surface that to the user.
  connectEntities(sourceEntityId: string, targetEntityId: string): void;
  undo(): void;
  redo(): void;
  jumpToHistory(index: number): void;
  save(): Promise<void>;
  load(modelId: string): Promise<void>;
  newModel(id: string, name: string): void;
  // Replaces the live model wholesale — used after parsing an imported schema (e.g. an
  // Appwrite CLI appwrite.json export) into a Model via an Adapter's fromNativeSchema.
  importModel(model: Model): void;
  // Call after a successful deployPlan() so Diff/Deploy Plan reflect that the live
  // database now matches the current model — same baseline update as save(), just
  // triggered by "it actually ran" rather than "the JSON snapshot was written".
  markDeployed(): void;
  // Governance (erwin-style Domain/Dictionary/Naming Rules) — see /docs/operations.md.
  createDomain(domain: Domain): void;
  updateDomain(domainId: string, changes: UpdateDomainPayload["changes"]): void;
  deleteDomain(domainId: string): void;
  assignDomain(entityId: string, attributeId: string, domainId: string): void;
  unassignDomain(entityId: string, attributeId: string): void;
  addDictionaryEntry(entry: DictionaryEntry): void;
  updateDictionaryEntry(entryId: string, changes: UpdateDictionaryEntryPayload["changes"]): void;
  deleteDictionaryEntry(entryId: string): void;
  updateNamingRuleSet(namingRules: NamingRuleSet | undefined): void;
  // Versioning (erwin "Baseline" / erdcloud version history) — snapshots live alongside
  // the Model document in ModelStore, not in this in-memory state, so they survive reloads.
  versions: VersionSummary[];
  versionsLoading: boolean;
  refreshVersions(): Promise<void>;
  saveVersion(label: string): Promise<void>;
  // Replaces the live model with a saved snapshot — treated like importModel (the new
  // baseline for Diff), since restoring is "load this state", not "edit toward it".
  restoreVersion(versionId: string): Promise<void>;
  deleteVersion(versionId: string): Promise<void>;
  // Used by the Versions tab to diff a version against the current model on demand,
  // without holding every fetched snapshot in this store's state.
  getVersionSnapshot(versionId: string): Promise<Model | null>;
}

// One undo/redo stack per loaded model — reassigned on load()/newModel() so undoing
// never crosses between unrelated models.
let history = new OperationHistory();

function historyFlags() {
  return {
    canUndo: history.canUndo(),
    canRedo: history.canRedo(),
    historyLog: history.entries().map(describeHistoryEntry),
  };
}

const initialModel = emptyModel("default", "Untitled Model");

export const useEditorStore = create<EditorState>((set, get) => ({
  model: initialModel,
  savedModel: initialModel,
  issues: [],
  canUndo: false,
  canRedo: false,
  historyLog: [],
  saving: false,
  loading: false,
  versions: [],
  versionsLoading: false,

  addEntity(logicalName) {
    const id = crypto.randomUUID();
    const physicalName = toPhysicalName(logicalName);
    const { model, operation } = createEntity(
      get().model,
      {
        id,
        logicalName,
        physicalName,
        tags: [],
        attributes: [
          {
            id: `${id}_id`,
            name: "id",
            logicalName: "ID",
            type: "uuid",
            nullable: false,
            isPrimaryKey: true,
            isForeignKey: false,
            isUnique: true,
          },
        ],
        indexes: [],
        ui: { x: get().model.entities.length * ENTITY_SPACING, y: 0 },
      },
      ACTOR_ID,
    );
    history.push(operation);
    set({ model, issues: validateModel(model), ...historyFlags() });
  },

  removeEntity(entityId) {
    const { model, transaction } = deleteEntityCascade(get().model, entityId, ACTOR_ID);
    history.push(transaction);
    set({ model, issues: validateModel(model), ...historyFlags() });
  },

  connectEntities(sourceEntityId, targetEntityId) {
    const { model, transaction } = connectEntitiesCascade(
      get().model,
      {
        sourceEntityId,
        targetEntityId,
        relationshipId: crypto.randomUUID(),
        foreignKeyAttributeId: crypto.randomUUID(),
      },
      ACTOR_ID,
    );
    history.push(transaction);
    set({ model, issues: validateModel(model), ...historyFlags() });
  },

  undo() {
    const model = history.undo(get().model);
    set({ model, issues: validateModel(model), ...historyFlags() });
  },

  redo() {
    const model = history.redo(get().model);
    set({ model, issues: validateModel(model), ...historyFlags() });
  },

  jumpToHistory(index) {
    const model = history.jumpToIndex(get().model, index);
    set({ model, issues: validateModel(model), ...historyFlags() });
  },

  async save() {
    set({ saving: true });
    try {
      const model = get().model;
      await getModelStore().save(model);
      set({ savedModel: model });
    } finally {
      set({ saving: false });
    }
  },

  async load(modelId) {
    set({ loading: true });
    try {
      const loaded = await getModelStore().load(modelId);
      const model = loaded ?? emptyModel(modelId, modelId);
      history = new OperationHistory();
      set({ model, savedModel: model, issues: validateModel(model), ...historyFlags() });
    } finally {
      set({ loading: false });
    }
  },

  newModel(id, name) {
    const model = emptyModel(id, name);
    history = new OperationHistory();
    set({ model, savedModel: model, issues: [], ...historyFlags() });
  },

  importModel(model) {
    history = new OperationHistory();
    set({ model, savedModel: model, issues: validateModel(model), ...historyFlags() });
  },

  markDeployed() {
    set({ savedModel: get().model });
  },

  createDomain(domain) {
    const { model, operation } = createDomainOp(get().model, { domain }, ACTOR_ID);
    history.push(operation);
    set({ model, issues: validateModel(model), ...historyFlags() });
  },

  updateDomain(domainId, changes) {
    const { model, transaction } = updateDomainCascade(get().model, domainId, changes, ACTOR_ID);
    history.push(transaction);
    set({ model, issues: validateModel(model), ...historyFlags() });
  },

  deleteDomain(domainId) {
    const { model, transaction } = deleteDomainCascade(get().model, domainId, ACTOR_ID);
    history.push(transaction);
    set({ model, issues: validateModel(model), ...historyFlags() });
  },

  assignDomain(entityId, attributeId, domainId) {
    const { model, operation } = assignDomainOp(
      get().model,
      { entityId, attributeId, domainId },
      ACTOR_ID,
    );
    history.push(operation);
    set({ model, issues: validateModel(model), ...historyFlags() });
  },

  unassignDomain(entityId, attributeId) {
    const { model, operation } = unassignDomainOp(get().model, { entityId, attributeId }, ACTOR_ID);
    history.push(operation);
    set({ model, issues: validateModel(model), ...historyFlags() });
  },

  addDictionaryEntry(entry) {
    const { model, operation } = addDictionaryEntryOp(get().model, { entry }, ACTOR_ID);
    history.push(operation);
    set({ model, issues: validateModel(model), ...historyFlags() });
  },

  updateDictionaryEntry(entryId, changes) {
    const { model, operation } = updateDictionaryEntryOp(
      get().model,
      { entryId, changes },
      ACTOR_ID,
    );
    history.push(operation);
    set({ model, issues: validateModel(model), ...historyFlags() });
  },

  deleteDictionaryEntry(entryId) {
    const { model, operation } = deleteDictionaryEntryOp(get().model, { entryId }, ACTOR_ID);
    history.push(operation);
    set({ model, issues: validateModel(model), ...historyFlags() });
  },

  updateNamingRuleSet(namingRules) {
    const { model, operation } = updateNamingRuleSetOp(get().model, { namingRules }, ACTOR_ID);
    history.push(operation);
    set({ model, issues: validateModel(model), ...historyFlags() });
  },

  async refreshVersions() {
    set({ versionsLoading: true });
    try {
      const versions = await getModelStore().listVersions(get().model.id);
      set({ versions });
    } finally {
      set({ versionsLoading: false });
    }
  },

  async saveVersion(label) {
    const model = get().model;
    await getModelStore().saveVersion(model.id, {
      id: crypto.randomUUID(),
      label,
      createdAt: new Date().toISOString(),
      snapshot: model,
    });
    await get().refreshVersions();
  },

  async restoreVersion(versionId) {
    const snapshot = await getModelStore().getVersion(get().model.id, versionId);
    if (!snapshot) return;
    history = new OperationHistory();
    set({
      model: snapshot,
      savedModel: snapshot,
      issues: validateModel(snapshot),
      ...historyFlags(),
    });
  },

  async deleteVersion(versionId) {
    await getModelStore().deleteVersion(get().model.id, versionId);
    await get().refreshVersions();
  },

  async getVersionSnapshot(versionId) {
    return getModelStore().getVersion(get().model.id, versionId);
  },
}));
