import { create } from "zustand";
import type { Model } from "@modelforge/schema-engine";
import { validateModel, type ValidationIssue } from "@modelforge/schema-engine";
import {
  createEntity,
  deleteEntityCascade,
  describeHistoryEntry,
  OperationHistory,
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
  undo(): void;
  redo(): void;
  jumpToHistory(index: number): void;
  save(): Promise<void>;
  load(modelId: string): Promise<void>;
  newProject(id: string, name: string): void;
  // Replaces the live model wholesale — used after parsing an imported schema (e.g. an
  // Appwrite CLI appwrite.json export) into a Model via an Adapter's fromNativeSchema.
  importModel(model: Model): void;
  // Call after a successful deployPlan() so Diff/Deploy Plan reflect that the live
  // database now matches the current model — same baseline update as save(), just
  // triggered by "it actually ran" rather than "the JSON snapshot was written".
  markDeployed(): void;
}

// One undo/redo stack per loaded model — reassigned on load()/newProject() so undoing
// never crosses between unrelated projects.
let history = new OperationHistory();

function historyFlags() {
  return {
    canUndo: history.canUndo(),
    canRedo: history.canRedo(),
    historyLog: history.entries().map(describeHistoryEntry),
  };
}

const initialModel = emptyModel("default", "Untitled Project");

export const useEditorStore = create<EditorState>((set, get) => ({
  model: initialModel,
  savedModel: initialModel,
  issues: [],
  canUndo: false,
  canRedo: false,
  historyLog: [],
  saving: false,
  loading: false,

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

  newProject(id, name) {
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
}));
