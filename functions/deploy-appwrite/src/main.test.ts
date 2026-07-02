import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("node-appwrite", () => ({
  Client: class FakeClient {
    setEndpoint = vi.fn().mockReturnThis();
    setProject = vi.fn().mockReturnThis();
    setKey = vi.fn().mockReturnThis();
  },
  Databases: class FakeDatabases {},
  RelationshipType: {},
  RelationMutate: {},
  DatabasesIndexType: {},
}));

const applyPlanMock = vi.fn();
vi.mock("./applyPlan.js", () => ({ applyPlan: applyPlanMock }));

const { default: main } = await import("./main.js");

function fakeContext(overrides: { bodyJson?: unknown; headers?: Record<string, string> } = {}) {
  const jsonCalls: Array<{ data: unknown; status?: number }> = [];
  return {
    req: {
      bodyJson: overrides.bodyJson,
      headers: overrides.headers ?? { "x-appwrite-user-id": "user-1" },
    },
    res: {
      json: (data: unknown, status?: number) => {
        jsonCalls.push({ data, status });
        return { data, status };
      },
    },
    log: vi.fn(),
    error: vi.fn(),
    jsonCalls,
  };
}

const originalEnv = { ...process.env };

afterEach(() => {
  vi.clearAllMocks();
  process.env = { ...originalEnv };
});

describe("main (Appwrite Function entrypoint)", () => {
  it("rejects an unauthenticated execution", async () => {
    const ctx = fakeContext({ headers: {} });
    await main(ctx as never);
    expect(ctx.jsonCalls[0]?.status).toBe(401);
    expect(applyPlanMock).not.toHaveBeenCalled();
  });

  it("rejects a malformed body", async () => {
    const ctx = fakeContext({ bodyJson: { nonsense: true } });
    await main(ctx as never);
    expect(ctx.jsonCalls[0]?.status).toBe(400);
  });

  it("rejects when the Function's env vars are not configured", async () => {
    delete process.env.APPWRITE_FUNCTION_API_KEY;
    const ctx = fakeContext({
      bodyJson: { databaseId: "db-1", plan: { id: "p1", adapterKind: "appwrite", steps: [] } },
    });
    await main(ctx as never);
    expect(ctx.jsonCalls[0]?.status).toBe(500);
  });

  it("applies the plan and returns the DeployResult on success", async () => {
    process.env.APPWRITE_FUNCTION_API_ENDPOINT = "https://appwrite.example/v1";
    process.env.APPWRITE_FUNCTION_PROJECT_ID = "proj-1";
    process.env.APPWRITE_FUNCTION_API_KEY = "dynamic-key";
    applyPlanMock.mockResolvedValueOnce({ planId: "p1", appliedSteps: ["customer"] });

    const ctx = fakeContext({
      bodyJson: { databaseId: "db-1", plan: { id: "p1", adapterKind: "appwrite", steps: [] } },
    });
    await main(ctx as never);

    expect(applyPlanMock).toHaveBeenCalledWith(expect.anything(), "db-1", {
      id: "p1",
      adapterKind: "appwrite",
      steps: [],
    });
    expect(ctx.jsonCalls[0]?.data).toEqual({ planId: "p1", appliedSteps: ["customer"] });
  });

  it("logs an error (but still returns 200 with the result) when the plan reports a failedStep", async () => {
    process.env.APPWRITE_FUNCTION_API_ENDPOINT = "https://appwrite.example/v1";
    process.env.APPWRITE_FUNCTION_PROJECT_ID = "proj-1";
    process.env.APPWRITE_FUNCTION_API_KEY = "dynamic-key";
    const failedResult = {
      planId: "p1",
      appliedSteps: [],
      failedStep: {
        step: { action: "create-collection", target: "customer", destructive: false },
        error: "boom",
      },
    };
    applyPlanMock.mockResolvedValueOnce(failedResult);

    const ctx = fakeContext({
      bodyJson: { databaseId: "db-1", plan: { id: "p1", adapterKind: "appwrite", steps: [] } },
    });
    await main(ctx as never);

    expect(ctx.error).toHaveBeenCalled();
    expect(ctx.jsonCalls[0]?.data).toEqual(failedResult);
  });
});
