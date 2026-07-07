import { create } from "zustand";
import type { VersionSummary } from "@modelforge/api";
import type {
  Attribute,
  ColumnType,
  DictionaryEntry,
  Domain,
  EnumType,
  Index,
  Memo,
  Model,
  NamingRuleSet,
  Relationship,
  Sequence,
  SubjectArea,
  View,
} from "@modelforge/schema-engine";
import { validateModel, type ValidationIssue } from "@modelforge/schema-engine";
import {
  addAttribute as addAttributeOp,
  addDictionaryEntry as addDictionaryEntryOp,
  assignDomain as assignDomainOp,
  assignEntityToSubjectArea as assignEntityToSubjectAreaOp,
  assignEnumToAttribute as assignEnumToAttributeOp,
  changeAttributeType as changeAttributeTypeOp,
  changeRelationshipCardinality as changeRelationshipCardinalityOp,
  changeRelationshipKind as changeRelationshipKindOp,
  connectEntitiesCascade,
  createDomain as createDomainOp,
  createEntity,
  createEnum as createEnumOp,
  createIndex as createIndexOp,
  createMemo as createMemoOp,
  createSequence as createSequenceOp,
  createSubjectArea as createSubjectAreaOp,
  createView as createViewOp,
  deleteDictionaryEntry as deleteDictionaryEntryOp,
  deleteDomainCascade,
  deleteEntityCascade,
  deleteEnumCascade,
  deleteIndex as deleteIndexOp,
  deleteMemo as deleteMemoOp,
  deleteRelationship as deleteRelationshipOp,
  deleteSequence as deleteSequenceOp,
  deleteSubjectAreaCascade,
  deleteView as deleteViewOp,
  describeHistoryEntry,
  moveEntitiesTransaction,
  moveEntity as moveEntityOp,
  moveMemo as moveMemoOp,
  OperationHistory,
  removeAttribute as removeAttributeOp,
  renameAttribute as renameAttributeOp,
  renameEntity as renameEntityOp,
  setAttributeComment as setAttributeCommentOp,
  setAttributeDefault as setAttributeDefaultOp,
  setAttributeFlags as setAttributeFlagsOp,
  setRelationshipMeta as setRelationshipMetaOp,
  unassignDomain as unassignDomainOp,
  unassignEntityFromSubjectArea as unassignEntityFromSubjectAreaOp,
  unassignEnumFromAttribute as unassignEnumFromAttributeOp,
  updateDictionaryEntry as updateDictionaryEntryOp,
  updateDomainCascade,
  updateEnumValues as updateEnumValuesOp,
  updateMemoText as updateMemoTextOp,
  updateNamingRuleSet as updateNamingRuleSetOp,
  updateSequence as updateSequenceOp,
  updateSubjectArea as updateSubjectAreaOp,
  updateView as updateViewOp,
  type UpdateDictionaryEntryPayload,
  type UpdateDomainPayload,
  type UpdateSequencePayload,
  type UpdateSubjectAreaPayload,
  type UpdateViewPayload,
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
  // Persists a canvas drag's end position. A no-op when the position didn't actually
  // change (React Flow can fire drag-stop for a zero-movement click) so the undo
  // history never fills with junk MoveEntity entries.
  moveEntity(entityId: string, x: number, y: number): void;
  // Applies a LayoutEngine result (entityId -> position) as one Transaction, so a whole
  // auto-layout run undoes with a single Ctrl+Z. Skips pushing anything when the layout
  // wouldn't move any entity.
  applyLayout(positions: Record<string, { x: number; y: number }>, label: string): void;
  // Draws a Relationship from a Canvas drag between two entities' Handles — creates a
  // foreign key Attribute on the target (mirroring the source's primary key) and the
  // Relationship together. Throws if the source has no single-column primary key to
  // reference; callers (the Canvas) are expected to surface that to the user.
  connectEntities(sourceEntityId: string, targetEntityId: string): void;
  // Entity/Attribute Inspector — see components/EntityInspector.tsx. These all wrap
  // single erd-engine Operations, following the same push-then-set pattern as every
  // other action here.
  renameEntity(entityId: string, changes: { logicalName?: string; physicalName?: string }): void;
  addAttribute(entityId: string, attribute: Attribute): void;
  removeAttribute(entityId: string, attributeId: string): void;
  renameAttribute(
    entityId: string,
    attributeId: string,
    changes: { name?: string; logicalName?: string },
  ): void;
  changeAttributeType(
    entityId: string,
    attributeId: string,
    type: ColumnType,
    length?: number,
    scale?: number,
  ): void;
  setAttributeFlags(
    entityId: string,
    attributeId: string,
    flags: Partial<Pick<Attribute, "nullable" | "isPrimaryKey" | "isForeignKey" | "isUnique">>,
  ): void;
  setAttributeDefault(entityId: string, attributeId: string, value: Attribute["default"]): void;
  setAttributeComment(entityId: string, attributeId: string, value: Attribute["comment"]): void;
  createIndex(entityId: string, index: Index): void;
  deleteIndex(entityId: string, indexId: string): void;
  // Relationship Inspector — see components/RelationshipInspector.tsx.
  changeRelationshipCardinality(
    relationshipId: string,
    cardinality: Relationship["cardinality"],
  ): void;
  changeRelationshipKind(relationshipId: string, kind: Relationship["kind"]): void;
  setRelationshipMeta(
    relationshipId: string,
    meta: Partial<Pick<Relationship, "name" | "optionality" | "onDelete" | "onUpdate">>,
  ): void;
  deleteRelationship(relationshipId: string): void;
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
  // Subject Areas (erwin-style canvas grouping) — see /docs/operations.md.
  createSubjectArea(subjectArea: SubjectArea): void;
  updateSubjectArea(subjectAreaId: string, changes: UpdateSubjectAreaPayload["changes"]): void;
  deleteSubjectArea(subjectAreaId: string): void;
  assignEntityToSubjectArea(entityId: string, subjectAreaId: string): void;
  unassignEntityFromSubjectArea(entityId: string): void;
  // Enums (Model.enums, linked from Attribute.enumId) — see components/GovernancePanel.tsx.
  createEnum(enumType: EnumType): void;
  updateEnumValues(enumId: string, values: string[]): void;
  deleteEnum(enumId: string): void;
  assignEnumToAttribute(entityId: string, attributeId: string, enumId: string): void;
  unassignEnumFromAttribute(entityId: string, attributeId: string): void;
  // Sequences/Views (Model.sequences/Model.views) — see components/GovernancePanel.tsx.
  createSequence(sequence: Sequence): void;
  updateSequence(sequenceId: string, changes: UpdateSequencePayload["changes"]): void;
  deleteSequence(sequenceId: string): void;
  createView(view: View): void;
  updateView(viewId: string, changes: UpdateViewPayload["changes"]): void;
  deleteView(viewId: string): void;
  // Memos (freeform canvas sticky notes) — see components/Workspace.tsx.
  createMemo(memo: Memo): void;
  updateMemoText(memoId: string, text: string): void;
  moveMemo(memoId: string, x: number, y: number): void;
  deleteMemo(memoId: string): void;
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

  moveEntity(entityId, x, y) {
    const entity = get().model.entities.find((e) => e.id === entityId);
    if (!entity || (entity.ui.x === x && entity.ui.y === y)) return;
    const { model, operation } = moveEntityOp(get().model, { entityId, x, y }, ACTOR_ID);
    history.push(operation);
    set({ model, issues: validateModel(model), ...historyFlags() });
  },

  applyLayout(positions, label) {
    const { model, transaction } = moveEntitiesTransaction(get().model, positions, ACTOR_ID, label);
    if (transaction.operations.length === 0) return;
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

  renameEntity(entityId, changes) {
    const { model, operation } = renameEntityOp(get().model, { entityId, ...changes }, ACTOR_ID);
    history.push(operation);
    set({ model, issues: validateModel(model), ...historyFlags() });
  },

  addAttribute(entityId, attribute) {
    const { model, operation } = addAttributeOp(get().model, { entityId, attribute }, ACTOR_ID);
    history.push(operation);
    set({ model, issues: validateModel(model), ...historyFlags() });
  },

  removeAttribute(entityId, attributeId) {
    const { model, operation } = removeAttributeOp(
      get().model,
      { entityId, attributeId },
      ACTOR_ID,
    );
    history.push(operation);
    set({ model, issues: validateModel(model), ...historyFlags() });
  },

  renameAttribute(entityId, attributeId, changes) {
    const { model, operation } = renameAttributeOp(
      get().model,
      { entityId, attributeId, ...changes },
      ACTOR_ID,
    );
    history.push(operation);
    set({ model, issues: validateModel(model), ...historyFlags() });
  },

  changeAttributeType(entityId, attributeId, type, length, scale) {
    const { model, operation } = changeAttributeTypeOp(
      get().model,
      { entityId, attributeId, type, length, scale },
      ACTOR_ID,
    );
    history.push(operation);
    set({ model, issues: validateModel(model), ...historyFlags() });
  },

  setAttributeFlags(entityId, attributeId, flags) {
    const { model, operation } = setAttributeFlagsOp(
      get().model,
      { entityId, attributeId, flags },
      ACTOR_ID,
    );
    history.push(operation);
    set({ model, issues: validateModel(model), ...historyFlags() });
  },

  setAttributeDefault(entityId, attributeId, value) {
    const { model, operation } = setAttributeDefaultOp(
      get().model,
      { entityId, attributeId, default: value },
      ACTOR_ID,
    );
    history.push(operation);
    set({ model, issues: validateModel(model), ...historyFlags() });
  },

  setAttributeComment(entityId, attributeId, value) {
    const { model, operation } = setAttributeCommentOp(
      get().model,
      { entityId, attributeId, comment: value },
      ACTOR_ID,
    );
    history.push(operation);
    set({ model, issues: validateModel(model), ...historyFlags() });
  },

  createIndex(entityId, index) {
    const { model, operation } = createIndexOp(get().model, { entityId, index }, ACTOR_ID);
    history.push(operation);
    set({ model, issues: validateModel(model), ...historyFlags() });
  },

  deleteIndex(entityId, indexId) {
    const { model, operation } = deleteIndexOp(get().model, { entityId, indexId }, ACTOR_ID);
    history.push(operation);
    set({ model, issues: validateModel(model), ...historyFlags() });
  },

  changeRelationshipCardinality(relationshipId, cardinality) {
    const { model, operation } = changeRelationshipCardinalityOp(
      get().model,
      { relationshipId, cardinality },
      ACTOR_ID,
    );
    history.push(operation);
    set({ model, issues: validateModel(model), ...historyFlags() });
  },

  changeRelationshipKind(relationshipId, kind) {
    const { model, operation } = changeRelationshipKindOp(
      get().model,
      { relationshipId, kind },
      ACTOR_ID,
    );
    history.push(operation);
    set({ model, issues: validateModel(model), ...historyFlags() });
  },

  setRelationshipMeta(relationshipId, meta) {
    const { model, operation } = setRelationshipMetaOp(
      get().model,
      { relationshipId, meta },
      ACTOR_ID,
    );
    history.push(operation);
    set({ model, issues: validateModel(model), ...historyFlags() });
  },

  deleteRelationship(relationshipId) {
    const { model, operation } = deleteRelationshipOp(get().model, { relationshipId }, ACTOR_ID);
    history.push(operation);
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

  createSubjectArea(subjectArea) {
    const { model, operation } = createSubjectAreaOp(get().model, { subjectArea }, ACTOR_ID);
    history.push(operation);
    set({ model, issues: validateModel(model), ...historyFlags() });
  },

  updateSubjectArea(subjectAreaId, changes) {
    const { model, operation } = updateSubjectAreaOp(
      get().model,
      { subjectAreaId, changes },
      ACTOR_ID,
    );
    history.push(operation);
    set({ model, issues: validateModel(model), ...historyFlags() });
  },

  deleteSubjectArea(subjectAreaId) {
    const { model, transaction } = deleteSubjectAreaCascade(get().model, subjectAreaId, ACTOR_ID);
    history.push(transaction);
    set({ model, issues: validateModel(model), ...historyFlags() });
  },

  assignEntityToSubjectArea(entityId, subjectAreaId) {
    const { model, operation } = assignEntityToSubjectAreaOp(
      get().model,
      { entityId, subjectAreaId },
      ACTOR_ID,
    );
    history.push(operation);
    set({ model, issues: validateModel(model), ...historyFlags() });
  },

  unassignEntityFromSubjectArea(entityId) {
    const { model, operation } = unassignEntityFromSubjectAreaOp(
      get().model,
      { entityId },
      ACTOR_ID,
    );
    history.push(operation);
    set({ model, issues: validateModel(model), ...historyFlags() });
  },

  createEnum(enumType) {
    const { model, operation } = createEnumOp(get().model, { enumType }, ACTOR_ID);
    history.push(operation);
    set({ model, issues: validateModel(model), ...historyFlags() });
  },

  updateEnumValues(enumId, values) {
    const { model, operation } = updateEnumValuesOp(get().model, { enumId, values }, ACTOR_ID);
    history.push(operation);
    set({ model, issues: validateModel(model), ...historyFlags() });
  },

  deleteEnum(enumId) {
    const { model, transaction } = deleteEnumCascade(get().model, enumId, ACTOR_ID);
    history.push(transaction);
    set({ model, issues: validateModel(model), ...historyFlags() });
  },

  assignEnumToAttribute(entityId, attributeId, enumId) {
    const { model, operation } = assignEnumToAttributeOp(
      get().model,
      { entityId, attributeId, enumId },
      ACTOR_ID,
    );
    history.push(operation);
    set({ model, issues: validateModel(model), ...historyFlags() });
  },

  unassignEnumFromAttribute(entityId, attributeId) {
    const { model, operation } = unassignEnumFromAttributeOp(
      get().model,
      { entityId, attributeId },
      ACTOR_ID,
    );
    history.push(operation);
    set({ model, issues: validateModel(model), ...historyFlags() });
  },

  createSequence(sequence) {
    const { model, operation } = createSequenceOp(get().model, { sequence }, ACTOR_ID);
    history.push(operation);
    set({ model, issues: validateModel(model), ...historyFlags() });
  },

  updateSequence(sequenceId, changes) {
    const { model, operation } = updateSequenceOp(get().model, { sequenceId, changes }, ACTOR_ID);
    history.push(operation);
    set({ model, issues: validateModel(model), ...historyFlags() });
  },

  deleteSequence(sequenceId) {
    const { model, operation } = deleteSequenceOp(get().model, { sequenceId }, ACTOR_ID);
    history.push(operation);
    set({ model, issues: validateModel(model), ...historyFlags() });
  },

  createView(view) {
    const { model, operation } = createViewOp(get().model, { view }, ACTOR_ID);
    history.push(operation);
    set({ model, issues: validateModel(model), ...historyFlags() });
  },

  updateView(viewId, changes) {
    const { model, operation } = updateViewOp(get().model, { viewId, changes }, ACTOR_ID);
    history.push(operation);
    set({ model, issues: validateModel(model), ...historyFlags() });
  },

  deleteView(viewId) {
    const { model, operation } = deleteViewOp(get().model, { viewId }, ACTOR_ID);
    history.push(operation);
    set({ model, issues: validateModel(model), ...historyFlags() });
  },

  createMemo(memo) {
    const { model, operation } = createMemoOp(get().model, { memo }, ACTOR_ID);
    history.push(operation);
    set({ model, issues: validateModel(model), ...historyFlags() });
  },

  updateMemoText(memoId, text) {
    const { model, operation } = updateMemoTextOp(get().model, { memoId, text }, ACTOR_ID);
    history.push(operation);
    set({ model, issues: validateModel(model), ...historyFlags() });
  },

  moveMemo(memoId, x, y) {
    const memo = (get().model.memos ?? []).find((m) => m.id === memoId);
    if (!memo || (memo.x === x && memo.y === y)) return;
    const { model, operation } = moveMemoOp(get().model, { memoId, x, y }, ACTOR_ID);
    history.push(operation);
    set({ model, issues: validateModel(model), ...historyFlags() });
  },

  deleteMemo(memoId) {
    const { model, operation } = deleteMemoOp(get().model, { memoId }, ACTOR_ID);
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
