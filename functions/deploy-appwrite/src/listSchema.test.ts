import { afterEach, describe, expect, it, vi } from "vitest";

const listCollections = vi.fn();

class FakeDatabases {
  listCollections = listCollections;
}

vi.mock("node-appwrite", () => ({
  Databases: FakeDatabases,
  Query: {
    limit: (n: number) => `limit(${n})`,
    cursorAfter: (id: string) => `cursorAfter(${id})`,
  },
}));

const { listSchema } = await import("./listSchema.js");

afterEach(() => {
  vi.clearAllMocks();
});

describe("listSchema", () => {
  it("returns the raw $id/name/attributes/indexes shape for each collection", async () => {
    listCollections.mockResolvedValueOnce({
      collections: [
        {
          $id: "customer",
          name: "Customer",
          attributes: [{ key: "email", type: "string" }],
          indexes: [{ key: "email_idx", type: "unique", attributes: ["email"] }],
        },
      ],
    });

    const result = await listSchema({} as never, "db-1");

    expect(listCollections).toHaveBeenCalledWith({ databaseId: "db-1", queries: ["limit(100)"] });
    expect(result).toEqual({
      collections: [
        {
          $id: "customer",
          name: "Customer",
          attributes: [{ key: "email", type: "string" }],
          indexes: [{ key: "email_idx", type: "unique", attributes: ["email"] }],
        },
      ],
    });
  });

  it("paginates with a cursor when a page comes back full", async () => {
    const fullPage = Array.from({ length: 100 }, (_, i) => ({
      $id: `col-${i}`,
      name: `Col ${i}`,
      attributes: [],
      indexes: [],
    }));
    listCollections.mockResolvedValueOnce({ collections: fullPage }).mockResolvedValueOnce({
      collections: [{ $id: "col-100", name: "Col 100", attributes: [], indexes: [] }],
    });

    const result = await listSchema({} as never, "db-1");

    expect(listCollections).toHaveBeenCalledTimes(2);
    expect(listCollections).toHaveBeenNthCalledWith(2, {
      databaseId: "db-1",
      queries: ["limit(100)", "cursorAfter(col-99)"],
    });
    expect(result.collections).toHaveLength(101);
  });

  it("stops after a single short page", async () => {
    listCollections.mockResolvedValueOnce({ collections: [] });

    const result = await listSchema({} as never, "db-1");

    expect(listCollections).toHaveBeenCalledTimes(1);
    expect(result.collections).toEqual([]);
  });
});
