import { describe, expect, it, vi } from "vitest";
import {
  modelToNodes,
  modelToEdges,
  modelToMemoNodes,
  modelToSubjectAreaNodes,
} from "./ErdCanvas.js";
import type { Model } from "@modelforge/schema-engine";

const model: Model = {
  id: "m1",
  name: "Shop",
  adapter: "postgresql",
  relationships: [
    {
      id: "r1",
      name: "places",
      sourceEntityId: "customer",
      targetEntityId: "order",
      cardinality: "one-to-many",
      kind: "non-identifying",
      optionality: "mandatory",
      sourceAttributeIds: [],
      targetAttributeIds: [],
    },
  ],
  views: [],
  sequences: [],
  enums: [],
  entities: [
    {
      id: "customer",
      logicalName: "Customer",
      physicalName: "customer",
      tags: [],
      attributes: [],
      indexes: [],
      ui: { x: 100, y: 200 },
    },
  ],
};

describe("modelToNodes", () => {
  it("maps entity ui position onto the node and passes the entity + Model.enums through as data", () => {
    expect(modelToNodes(model)).toEqual([
      {
        id: "customer",
        type: "entity",
        position: { x: 100, y: 200 },
        data: { entity: model.entities[0], enums: model.enums, domains: [] },
      },
    ]);
  });
});

describe("modelToEdges", () => {
  it("maps relationship endpoints and a name+cardinality label onto the edge", () => {
    const edges = modelToEdges(model);
    expect(edges).toHaveLength(1);
    expect(edges[0]).toMatchObject({
      id: "r1",
      source: "customer",
      target: "order",
      label: "places (1 : N)",
    });
  });

  it("dashes non-identifying relationships and leaves identifying ones solid", () => {
    const [nonIdentifying] = modelToEdges(model);
    expect(nonIdentifying?.style?.strokeDasharray).toBe("6 4");

    const identifyingModel: Model = {
      ...model,
      relationships: [{ ...model.relationships[0]!, kind: "identifying" }],
    };
    const [identifying] = modelToEdges(identifyingModel);
    expect(identifying?.style?.strokeDasharray).toBeUndefined();
  });

  it("falls back to just the cardinality when the relationship has no name", () => {
    const unnamedModel: Model = {
      ...model,
      relationships: [{ ...model.relationships[0]!, name: undefined }],
    };
    expect(modelToEdges(unnamedModel)[0]?.label).toBe("1 : N");
  });
});

describe("modelToSubjectAreaNodes", () => {
  it("skips subject areas with no members", () => {
    const withEmptyArea: Model = {
      ...model,
      subjectAreas: [{ id: "sa1", name: "Empty", entityIds: [] }],
    };
    expect(modelToSubjectAreaNodes(withEmptyArea)).toEqual([]);
  });

  it("builds a background node sized around its member entities, tagged non-interactive", () => {
    const withArea: Model = {
      ...model,
      subjectAreas: [{ id: "sa1", name: "Sales", entityIds: ["customer"], color: "#ff0000" }],
    };
    const [node] = modelToSubjectAreaNodes(withArea);
    expect(node).toMatchObject({
      id: "subject-area:sa1",
      type: "subjectArea",
      data: { name: "Sales", color: "#ff0000" },
      draggable: false,
      selectable: false,
      connectable: false,
      zIndex: -1,
    });
    // Padded bounding box around the single member at (100, 200).
    expect(node?.position.x).toBeLessThan(100);
    expect(node?.position.y).toBeLessThan(200);
  });

  it("drops member ids that no longer resolve to an entity instead of throwing", () => {
    const withStaleMember: Model = {
      ...model,
      subjectAreas: [{ id: "sa1", name: "Sales", entityIds: ["customer", "ghost"] }],
    };
    expect(modelToSubjectAreaNodes(withStaleMember)).toHaveLength(1);
  });
});

describe("modelToMemoNodes", () => {
  it("maps each memo to a prefixed node id and its position", () => {
    const withMemo: Model = {
      ...model,
      memos: [{ id: "m1", text: "note", x: 50, y: 60, color: "#fff" }],
    };
    const [node] = modelToMemoNodes(withMemo, {});
    expect(node).toMatchObject({
      id: "memo:m1",
      type: "memo",
      position: { x: 50, y: 60 },
      data: { text: "note", color: "#fff" },
    });
  });

  it("binds onTextChange/onDelete callbacks to that memo's id", () => {
    const onUpdateMemoText = vi.fn();
    const onDeleteMemo = vi.fn();
    const withMemo: Model = {
      ...model,
      memos: [{ id: "m1", text: "note", x: 0, y: 0 }],
    };
    const [node] = modelToMemoNodes(withMemo, { onUpdateMemoText, onDeleteMemo });
    node?.data.onTextChange("edited");
    node?.data.onDelete();
    expect(onUpdateMemoText).toHaveBeenCalledWith({ memoId: "m1", text: "edited" });
    expect(onDeleteMemo).toHaveBeenCalledWith("m1");
  });
});
