import { describe, expect, it, vi } from "vitest";
import { createAppwriteAdapter, type AppwriteAdminAPI } from "./adapter.js";
import { planAppwriteDeployment } from "./plan.js";
import { shopModel } from "./test-fixtures.js";

function fakeAdminApi(overrides: Partial<AppwriteAdminAPI> = {}): AppwriteAdminAPI {
  return {
    createCollection: vi.fn().mockResolvedValue(undefined),
    dropCollection: vi.fn().mockResolvedValue(undefined),
    addAttribute: vi.fn().mockResolvedValue(undefined),
    dropAttribute: vi.fn().mockResolvedValue(undefined),
    alterAttribute: vi.fn().mockResolvedValue(undefined),
    createRelationship: vi.fn().mockResolvedValue(undefined),
    dropRelationship: vi.fn().mockResolvedValue(undefined),
    createIndex: vi.fn().mockResolvedValue(undefined),
    dropIndex: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("createAppwriteAdapter", () => {
  it("reports its kind and delegates the pure methods", () => {
    const adapter = createAppwriteAdapter(fakeAdminApi());
    expect(adapter.kind).toBe("appwrite");
    expect(adapter.mapType("integer")).toBe("integer");
    expect(adapter.validate(shopModel())).toEqual([]);
  });

  it("apply() dispatches each step to the matching AdminAPI method in order", async () => {
    const adminApi = fakeAdminApi();
    const adapter = createAppwriteAdapter(adminApi);
    const plan = planAppwriteDeployment(shopModel(), null);

    const result = await adapter.apply(plan, {});

    expect(adminApi.createCollection).toHaveBeenCalledTimes(2);
    expect(result.appliedSteps).toEqual(plan.steps.map((s) => s.target));
    expect(result.failedStep).toBeUndefined();
  });

  it("apply() stops and reports failedStep when a step throws", async () => {
    const adminApi = fakeAdminApi({
      createCollection: vi
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error("quota exceeded")),
    });
    const adapter = createAppwriteAdapter(adminApi);
    const plan = planAppwriteDeployment(shopModel(), null);

    const result = await adapter.apply(plan, {});

    expect(result.appliedSteps).toEqual(["customer"]);
    expect(result.failedStep?.error).toBe("quota exceeded");
  });

  it("rollbackPlan and plan round-trip through the adapter's own methods", () => {
    const adapter = createAppwriteAdapter(fakeAdminApi());
    const plan = adapter.plan(shopModel(), null);
    const rollback = adapter.rollbackPlan(plan);
    expect(rollback.steps).toHaveLength(plan.steps.length);
  });
});
