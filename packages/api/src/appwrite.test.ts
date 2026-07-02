import { afterEach, describe, expect, it, vi } from "vitest";

const setEndpoint = vi.fn().mockReturnThis();
const setProject = vi.fn().mockReturnThis();

class FakeClient {
  setEndpoint = setEndpoint;
  setProject = setProject;
}

class FakeAppwriteException extends Error {
  code: number;
  constructor(message: string, code: number) {
    super(message);
    this.code = code;
  }
}

const createEmailPasswordSession = vi.fn().mockResolvedValue({ $id: "session-1" });
const accountGet = vi.fn();

class FakeAccount {
  createEmailPasswordSession = createEmailPasswordSession;
  create = vi.fn();
  deleteSession = vi.fn();
  get = accountGet;
}

const updateDocument = vi.fn();
const createDocument = vi.fn();
const getDocument = vi.fn();

class FakeDatabases {
  updateDocument = updateDocument;
  createDocument = createDocument;
  getDocument = getDocument;
}

vi.mock("appwrite", () => ({
  Client: FakeClient,
  Account: FakeAccount,
  Databases: FakeDatabases,
  AppwriteException: FakeAppwriteException,
  ID: { unique: () => "generated-id" },
}));

const { createAppwriteClient } = await import("./client.js");
const { createAuthService } = await import("./auth.js");
const { createAppwriteModelStore } = await import("./modelStore.js");

afterEach(() => {
  vi.clearAllMocks();
});

describe("createAppwriteClient", () => {
  it("configures the client with endpoint and project", () => {
    createAppwriteClient({ endpoint: "https://appwrite.example/v1", projectId: "proj-1" });
    expect(setEndpoint).toHaveBeenCalledWith("https://appwrite.example/v1");
    expect(setProject).toHaveBeenCalledWith("proj-1");
  });
});

describe("createAuthService", () => {
  it("delegates login to Account.createEmailPasswordSession", async () => {
    const auth = createAuthService(new FakeClient() as never);
    await auth.login("user@example.com", "secret");
    expect(createEmailPasswordSession).toHaveBeenCalledWith("user@example.com", "secret");
  });

  it("returns null from currentUser when Account.get throws", async () => {
    accountGet.mockRejectedValueOnce(new Error("no session"));
    const auth = createAuthService(new FakeClient() as never);
    expect(await auth.currentUser()).toBeNull();
  });
});

describe("createAppwriteModelStore", () => {
  const config = { databaseId: "db-1", modelsTableId: "models" };
  const model = {
    id: "m1",
    name: "Shop",
    adapter: "appwrite" as const,
    entities: [],
    relationships: [],
    views: [],
    sequences: [],
    enums: [],
  };

  it("creates the document when it does not exist yet", async () => {
    updateDocument.mockRejectedValueOnce(new FakeAppwriteException("not found", 404));
    const store = createAppwriteModelStore(new FakeClient() as never, config);
    await store.save(model);
    expect(createDocument).toHaveBeenCalledWith("db-1", "models", "m1", {
      data: JSON.stringify(model),
    });
  });

  it("updates the document when it already exists", async () => {
    updateDocument.mockResolvedValueOnce({});
    const store = createAppwriteModelStore(new FakeClient() as never, config);
    await store.save(model);
    expect(createDocument).not.toHaveBeenCalled();
  });

  it("returns null when the document is missing", async () => {
    getDocument.mockRejectedValueOnce(new FakeAppwriteException("not found", 404));
    const store = createAppwriteModelStore(new FakeClient() as never, config);
    expect(await store.load("missing")).toBeNull();
  });

  it("round-trips a saved model", async () => {
    getDocument.mockResolvedValueOnce({ data: JSON.stringify(model) });
    const store = createAppwriteModelStore(new FakeClient() as never, config);
    expect(await store.load("m1")).toEqual(model);
  });
});
