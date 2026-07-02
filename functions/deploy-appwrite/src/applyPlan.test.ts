import { afterEach, describe, expect, it, vi } from "vitest";

const createCollection = vi.fn().mockResolvedValue({});
const createStringAttribute = vi.fn().mockResolvedValue({});
const createRelationshipAttribute = vi.fn().mockResolvedValue({});
const createIndex = vi.fn().mockResolvedValue({});
const deleteCollection = vi.fn().mockResolvedValue({});
const deleteAttribute = vi.fn().mockResolvedValue({});

class FakeDatabases {
  createCollection = createCollection;
  createStringAttribute = createStringAttribute;
  createRelationshipAttribute = createRelationshipAttribute;
  createIndex = createIndex;
  deleteCollection = deleteCollection;
  deleteAttribute = deleteAttribute;
}

vi.mock("node-appwrite", () => ({
  Databases: FakeDatabases,
  RelationshipType: {
    OneToOne: "oneToOne",
    OneToMany: "oneToMany",
    ManyToOne: "manyToOne",
    ManyToMany: "manyToMany",
  },
  RelationMutate: { Cascade: "cascade", Restrict: "restrict", SetNull: "setNull" },
  DatabasesIndexType: { Key: "key", Unique: "unique", Fulltext: "fulltext" },
}));

const { applyPlan } = await import("./applyPlan.js");
import type { MigrationPlan } from "./types.js";

const callOrder: string[] = [];
for (const [name, fn] of Object.entries({
  createCollection,
  createStringAttribute,
  createRelationshipAttribute,
  createIndex,
  deleteCollection,
  deleteAttribute,
})) {
  fn.mockImplementation(async (...args: unknown[]) => {
    callOrder.push(name);
    return {};
  });
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("applyPlan", () => {
  it("creates both collections and their plain attributes/indexes before either relationship", async () => {
    callOrder.length = 0;
    // customer's relationship attribute is bundled inside its create-collection step,
    // but "order" (the related collection) is created by a LATER step in the plan —
    // this is exactly the ordering hazard buildExecutionPlan exists to avoid.
    const plan: MigrationPlan = {
      id: "plan-1",
      adapterKind: "appwrite",
      steps: [
        {
          action: "create-collection",
          target: "customer",
          appwriteCall: {
            id: "customer",
            name: "Customer",
            attributes: [
              { key: "email", type: "string", required: true, array: false, size: 320 },
              {
                key: "orders",
                type: "relationship",
                relatedCollection: "order",
                relationType: "oneToMany",
                twoWay: true,
                onDelete: "cascade",
              },
            ],
            indexes: [{ key: "email_idx", type: "unique", attributes: ["email"] }],
          },
          destructive: false,
        },
        {
          action: "create-collection",
          target: "order",
          appwriteCall: { id: "order", name: "Order", attributes: [], indexes: [] },
          destructive: false,
        },
      ],
    };

    const result = await applyPlan({} as never, "db-1", plan);

    expect(result.failedStep).toBeUndefined();
    const relationshipIndex = callOrder.indexOf("createRelationshipAttribute");
    const orderCollectionIndex = callOrder.lastIndexOf("createCollection");
    expect(relationshipIndex).toBeGreaterThan(-1);
    expect(orderCollectionIndex).toBeGreaterThan(-1);
    expect(relationshipIndex).toBeGreaterThan(orderCollectionIndex);
    // Both collection shells (customer, order) run before the relationship attribute.
    expect(callOrder.filter((n) => n === "createCollection")).toHaveLength(2);
    expect(callOrder.indexOf("createStringAttribute")).toBeLessThan(relationshipIndex);
    expect(callOrder.indexOf("createIndex")).toBeLessThan(relationshipIndex);
  });

  it("runs drop-collection last", async () => {
    callOrder.length = 0;
    const plan: MigrationPlan = {
      id: "plan-2",
      adapterKind: "appwrite",
      steps: [
        { action: "drop-collection", target: "stale", destructive: true },
        {
          action: "create-collection",
          target: "fresh",
          appwriteCall: { id: "fresh", name: "Fresh", attributes: [], indexes: [] },
          destructive: false,
        },
      ],
    };

    await applyPlan({} as never, "db-1", plan);

    expect(callOrder.indexOf("createCollection")).toBeLessThan(
      callOrder.indexOf("deleteCollection"),
    );
  });

  it("stops on the first failure and reports it, without running later phases", async () => {
    callOrder.length = 0;
    createStringAttribute.mockRejectedValueOnce(new Error("quota exceeded"));

    const plan: MigrationPlan = {
      id: "plan-3",
      adapterKind: "appwrite",
      steps: [
        {
          action: "create-collection",
          target: "customer",
          appwriteCall: {
            id: "customer",
            name: "Customer",
            attributes: [{ key: "email", type: "string", required: true, array: false, size: 320 }],
            indexes: [],
          },
          destructive: false,
        },
        { action: "drop-collection", target: "unrelated", destructive: true },
      ],
    };

    const result = await applyPlan({} as never, "db-1", plan);

    expect(result.failedStep?.error).toBe("quota exceeded");
    expect(result.appliedSteps).toEqual(["customer"]);
    expect(deleteCollection).not.toHaveBeenCalled();
  });
});
