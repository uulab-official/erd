import { describe, expect, it } from "vitest";
import { diffModels } from "./index.js";
import type { Model, Entity, Relationship } from "@modelforge/schema-engine";

function entity(physicalName: string, x = 0): Entity {
  return {
    id: physicalName,
    logicalName: physicalName,
    physicalName,
    tags: [],
    attributes: [],
    indexes: [],
    ui: { x, y: 0 },
  };
}

function model(entities: Entity[]): Model {
  return {
    id: "m1",
    name: "Test",
    adapter: "postgresql",
    relationships: [],
    views: [],
    sequences: [],
    enums: [],
    entities,
  };
}

function relationship(id: string, name?: string): Relationship {
  return {
    id,
    name,
    sourceEntityId: "customer",
    targetEntityId: "order",
    cardinality: "one-to-many",
    kind: "non-identifying",
    optionality: "mandatory",
    sourceAttributeIds: [],
    targetAttributeIds: [],
  };
}

describe("diffModels", () => {
  it("detects added and removed entities", () => {
    const a = model([entity("customer")]);
    const b = model([entity("customer"), entity("order")]);
    expect(diffModels(a, b)).toEqual({
      added: ["order"],
      removed: [],
      changed: [],
      enums: { added: [], removed: [], changed: [] },
      relationships: { added: [], removed: [], changed: [] },
      sequences: { added: [], removed: [], changed: [] },
      views: { added: [], removed: [], changed: [] },
      domains: { added: [], removed: [], changed: [] },
      dictionary: { added: [], removed: [], changed: [] },
      subjectAreas: { added: [], removed: [], changed: [] },
      memos: { added: [], removed: [], changed: [] },
      namingRulesChanged: false,
    });
  });

  it("ignores ui-only position changes", () => {
    const a = model([entity("customer", 0)]);
    const b = model([entity("customer", 500)]);
    expect(diffModels(a, b).changed).toEqual([]);
  });

  it("detects an EnumType's values changing even when no entity/attribute changes", () => {
    const a = model([entity("customer")]);
    const b = model([entity("customer")]);
    a.enums = [{ id: "e1", name: "Status", values: ["pending"] }];
    b.enums = [{ id: "e1", name: "Status", values: ["pending", "shipped"] }];
    const diff = diffModels(a, b);
    expect(diff.changed).toEqual([]); // no entity touched
    expect(diff.enums).toEqual({ added: [], removed: [], changed: ["e1"] });
  });

  it("detects an Enum being added or removed", () => {
    const a = model([entity("customer")]);
    const b = model([entity("customer")]);
    b.enums = [{ id: "e1", name: "Status", values: ["pending"] }];
    expect(diffModels(a, b).enums).toEqual({ added: ["e1"], removed: [], changed: [] });
    expect(diffModels(b, a).enums).toEqual({ added: [], removed: ["e1"], changed: [] });
  });

  it("detects a relationship-only change (e.g. cardinality) even when no entity is touched", () => {
    const a = model([entity("customer"), entity("order")]);
    const b = model([entity("customer"), entity("order")]);
    a.relationships = [relationship("r1")];
    b.relationships = [{ ...relationship("r1"), cardinality: "one-to-one" }];
    const diff = diffModels(a, b);
    expect(diff.changed).toEqual([]); // no entity touched
    expect(diff.relationships).toEqual({ added: [], removed: [], changed: ["r1"] });
  });

  it("detects a relationship being added or removed", () => {
    const a = model([entity("customer"), entity("order")]);
    const b = model([entity("customer"), entity("order")]);
    b.relationships = [relationship("r1")];
    expect(diffModels(a, b).relationships).toEqual({ added: ["r1"], removed: [], changed: [] });
    expect(diffModels(b, a).relationships).toEqual({ added: [], removed: ["r1"], changed: [] });
  });

  it("detects a Sequence's fields changing even when no entity/attribute changes", () => {
    const a = model([entity("customer")]);
    const b = model([entity("customer")]);
    a.sequences = [{ id: "s1", name: "order_seq", start: 1, increment: 1 }];
    b.sequences = [{ id: "s1", name: "order_seq", start: 1, increment: 5 }];
    const diff = diffModels(a, b);
    expect(diff.changed).toEqual([]); // no entity touched
    expect(diff.sequences).toEqual({ added: [], removed: [], changed: ["s1"] });
  });

  it("detects a Sequence being added or removed", () => {
    const a = model([entity("customer")]);
    const b = model([entity("customer")]);
    b.sequences = [{ id: "s1", name: "order_seq", start: 1, increment: 1 }];
    expect(diffModels(a, b).sequences).toEqual({ added: ["s1"], removed: [], changed: [] });
    expect(diffModels(b, a).sequences).toEqual({ added: [], removed: ["s1"], changed: [] });
  });

  it("detects a View's sql changing even when no entity/attribute changes", () => {
    const a = model([entity("customer")]);
    const b = model([entity("customer")]);
    a.views = [{ id: "v1", name: "active_orders", sql: "SELECT * FROM orders" }];
    b.views = [{ id: "v1", name: "active_orders", sql: "SELECT * FROM orders WHERE 1=1" }];
    const diff = diffModels(a, b);
    expect(diff.changed).toEqual([]); // no entity touched
    expect(diff.views).toEqual({ added: [], removed: [], changed: ["v1"] });
  });

  it("detects a View being added or removed", () => {
    const a = model([entity("customer")]);
    const b = model([entity("customer")]);
    b.views = [{ id: "v1", name: "active_orders", sql: "SELECT * FROM orders" }];
    expect(diffModels(a, b).views).toEqual({ added: ["v1"], removed: [], changed: [] });
    expect(diffModels(b, a).views).toEqual({ added: [], removed: ["v1"], changed: [] });
  });

  it("detects a Domain being added, removed, and changed even when no entity/attribute changes", () => {
    const a = model([entity("customer")]);
    const b = model([entity("customer")]);
    a.domains = [{ id: "d1", name: "Email", type: "string", length: 255 }];
    b.domains = [{ id: "d1", name: "Email", type: "string", length: 320 }];
    const diff = diffModels(a, b);
    expect(diff.changed).toEqual([]);
    expect(diff.domains).toEqual({ added: [], removed: [], changed: ["d1"] });
    expect(diffModels(model([entity("customer")]), b).domains).toEqual({
      added: ["d1"],
      removed: [],
      changed: [],
    });
  });

  it("detects a DictionaryEntry being added, removed, and changed", () => {
    const a = model([entity("customer")]);
    const b = model([entity("customer")]);
    a.dictionary = [{ id: "e1", logicalTerm: "Customer ID", standardName: "customer_id" }];
    b.dictionary = [{ id: "e1", logicalTerm: "Customer ID", standardName: "cust_id" }];
    expect(diffModels(a, b).dictionary).toEqual({ added: [], removed: [], changed: ["e1"] });
    expect(diffModels(model([entity("customer")]), b).dictionary).toEqual({
      added: ["e1"],
      removed: [],
      changed: [],
    });
  });

  it("detects a SubjectArea being added, removed, and changed", () => {
    const a = model([entity("customer")]);
    const b = model([entity("customer")]);
    a.subjectAreas = [{ id: "sa1", name: "Sales", entityIds: ["customer"] }];
    b.subjectAreas = [{ id: "sa1", name: "Sales", entityIds: [] }];
    expect(diffModels(a, b).subjectAreas).toEqual({ added: [], removed: [], changed: ["sa1"] });
    expect(diffModels(model([entity("customer")]), b).subjectAreas).toEqual({
      added: ["sa1"],
      removed: [],
      changed: [],
    });
  });

  it("detects a Memo being added, removed, and changed", () => {
    const a = model([entity("customer")]);
    const b = model([entity("customer")]);
    a.memos = [{ id: "m1", text: "TODO", x: 0, y: 0 }];
    b.memos = [{ id: "m1", text: "TODO: rewrite for v2", x: 0, y: 0 }];
    expect(diffModels(a, b).memos).toEqual({ added: [], removed: [], changed: ["m1"] });
    expect(diffModels(model([entity("customer")]), b).memos).toEqual({
      added: ["m1"],
      removed: [],
      changed: [],
    });
  });

  it("treats a missing governance field the same as an explicitly empty one", () => {
    const a = model([entity("customer")]);
    const b = model([entity("customer")]);
    b.domains = [];
    const diff = diffModels(a, b);
    expect(diff.domains).toEqual({ added: [], removed: [], changed: [] });
  });

  it("detects a NamingRuleSet change as a boolean flag, not a keyed list", () => {
    const a = model([entity("customer")]);
    const b = model([entity("customer")]);
    a.namingRules = { case: "snake", reservedWords: [], abbreviations: {} };
    b.namingRules = { case: "camel", reservedWords: [], abbreviations: {} };
    expect(diffModels(a, b).namingRulesChanged).toBe(true);
    expect(diffModels(a, a).namingRulesChanged).toBe(false);
    expect(
      diffModels(model([entity("customer")]), model([entity("customer")])).namingRulesChanged,
    ).toBe(false);
  });
});
