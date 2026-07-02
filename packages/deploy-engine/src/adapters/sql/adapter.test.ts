import { describe, expect, it, vi } from "vitest";
import { createPostgreSQLAdapter, type SqlExecutor } from "./adapter.js";
import { shopModel } from "./test-fixtures.js";

function fakeExecutor(overrides: Partial<SqlExecutor> = {}): SqlExecutor {
  return {
    execute: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("createPostgreSQLAdapter", () => {
  it("reports its kind and delegates the pure methods", () => {
    const adapter = createPostgreSQLAdapter(fakeExecutor());
    expect(adapter.kind).toBe("postgresql");
    expect(adapter.mapType("integer")).toBe("integer");
    expect(adapter.validate(shopModel())).toEqual([]);
  });

  it("apply() executes every step with SQL, in order", async () => {
    const executor = fakeExecutor();
    const adapter = createPostgreSQLAdapter(executor);
    const plan = adapter.plan(shopModel(), null);

    const result = await adapter.apply(plan, {});

    expect(executor.execute).toHaveBeenCalledTimes(plan.steps.length);
    expect(result.appliedSteps).toEqual(plan.steps.map((s) => s.target));
    expect(result.failedStep).toBeUndefined();
  });

  it("apply() stops and reports failedStep when a step throws", async () => {
    const executor = fakeExecutor({
      execute: vi
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error("connection lost")),
    });
    const adapter = createPostgreSQLAdapter(executor);
    const plan = adapter.plan(shopModel(), null);

    const result = await adapter.apply(plan, {});

    expect(result.appliedSteps).toEqual([plan.steps[0]?.target]);
    expect(result.failedStep?.error).toBe("connection lost");
  });

  it("toNativeSchema/fromNativeSchema/plan/rollbackPlan round-trip through the adapter", () => {
    const adapter = createPostgreSQLAdapter(fakeExecutor());
    const native = adapter.toNativeSchema(shopModel());
    const model = adapter.fromNativeSchema(native);
    expect(model.entities.map((e) => e.id)).toEqual(["customer", "purchase_order"]);

    const plan = adapter.plan(shopModel(), null);
    const rollback = adapter.rollbackPlan(plan);
    expect(rollback.steps.length).toBeGreaterThan(0);
  });
});
