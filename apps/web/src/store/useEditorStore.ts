import { create } from "zustand";
import type { Model } from "@modelforge/schema-engine";
import { validateModel, type ValidationIssue } from "@modelforge/schema-engine";
import { createEntity, deleteEntityCascade, OperationHistory } from "@modelforge/erd-engine";
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
  issues: ValidationIssue[];
  canUndo: boolean;
  canRedo: boolean;
  saving: boolean;
  loading: boolean;
  addEntity(logicalName: string): void;
  removeEntity(entityId: string): void;
  undo(): void;
  redo(): void;
  save(): Promise<void>;
  load(modelId: string): Promise<void>;
  newProject(id: string, name: string): void;
}

// One undo/redo stack per loaded model — reassigned on load()/newProject() so undoing
// never crosses between unrelated projects.
let history = new OperationHistory();

function historyFlags() {
  return { canUndo: history.canUndo(), canRedo: history.canRedo() };
}

export const useEditorStore = create<EditorState>((set, get) => ({
  model: emptyModel("default", "Untitled Project"),
  issues: [],
  canUndo: false,
  canRedo: false,
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

  async save() {
    set({ saving: true });
    try {
      await getModelStore().save(get().model);
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
      set({ model, issues: validateModel(model), ...historyFlags() });
    } finally {
      set({ loading: false });
    }
  },

  newProject(id, name) {
    const model = emptyModel(id, name);
    history = new OperationHistory();
    set({ model, issues: [], ...historyFlags() });
  },
}));
