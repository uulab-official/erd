import { beforeEach, describe, expect, it, vi } from "vitest";

const createCollection = vi.fn().mockResolvedValue({});
const createStringAttribute = vi.fn().mockResolvedValue({});
const createIntegerAttribute = vi.fn().mockResolvedValue({});
const createFloatAttribute = vi.fn().mockResolvedValue({});
const createBooleanAttribute = vi.fn().mockResolvedValue({});
const createDatetimeAttribute = vi.fn().mockResolvedValue({});
const createEnumAttribute = vi.fn().mockResolvedValue({});
const createRelationshipAttribute = vi.fn().mockResolvedValue({});
const updateStringAttribute = vi.fn().mockResolvedValue({});
const updateRelationshipAttribute = vi.fn().mockResolvedValue({});
const deleteAttribute = vi.fn().mockResolvedValue({});
const createIndex = vi.fn().mockResolvedValue({});
const deleteIndex = vi.fn().mockResolvedValue({});
const deleteCollection = vi.fn().mockResolvedValue({});
const getAttribute = vi.fn().mockResolvedValue({ status: "available" });
const getIndex = vi.fn().mockResolvedValue({ status: "available" });

class FakeDatabases {
  createCollection = createCollection;
  createStringAttribute = createStringAttribute;
  createIntegerAttribute = createIntegerAttribute;
  createFloatAttribute = createFloatAttribute;
  createBooleanAttribute = createBooleanAttribute;
  createDatetimeAttribute = createDatetimeAttribute;
  createEnumAttribute = createEnumAttribute;
  createRelationshipAttribute = createRelationshipAttribute;
  updateStringAttribute = updateStringAttribute;
  updateRelationshipAttribute = updateRelationshipAttribute;
  deleteAttribute = deleteAttribute;
  createIndex = createIndex;
  deleteIndex = deleteIndex;
  deleteCollection = deleteCollection;
  getAttribute = getAttribute;
  getIndex = getIndex;
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
  AttributeStatus: {
    Available: "available",
    Processing: "processing",
    Failed: "failed",
    Stuck: "stuck",
  },
  IndexStatus: {
    Available: "available",
    Processing: "processing",
    Failed: "failed",
    Stuck: "stuck",
  },
}));

const { createAdminApi } = await import("./adminApi.js");

describe("createAdminApi", () => {
  const api = createAdminApi({} as never, "db-1");

  it("createCollectionShell creates a bare collection", async () => {
    await api.createCollectionShell({ id: "customer", name: "Customer" });
    expect(createCollection).toHaveBeenCalledWith({
      databaseId: "db-1",
      collectionId: "customer",
      name: "Customer",
    });
  });

  it("createPlainAttribute dispatches to the right typed create call", async () => {
    await api.createPlainAttribute("customer", {
      key: "email",
      type: "string",
      required: true,
      array: false,
      size: 320,
    });
    expect(createStringAttribute).toHaveBeenCalledWith(
      expect.objectContaining({
        databaseId: "db-1",
        collectionId: "customer",
        key: "email",
        size: 320,
      }),
    );
  });

  it("createRelationshipAttribute maps cardinality and onDelete to SDK enums", async () => {
    await api.createRelationshipAttribute("customer", {
      key: "orders",
      type: "relationship",
      relatedCollection: "order",
      relationType: "oneToMany",
      twoWay: true,
      onDelete: "cascade",
    });
    expect(createRelationshipAttribute).toHaveBeenCalledWith({
      databaseId: "db-1",
      collectionId: "customer",
      relatedCollectionId: "order",
      type: "oneToMany",
      twoWay: true,
      key: "orders",
      onDelete: "cascade",
    });
  });

  it("alterAttribute dispatches to the matching update call for a plain attribute", async () => {
    await api.alterAttribute("customer", {
      key: "email",
      type: "string",
      required: false,
      array: false,
      size: 500,
    });
    expect(updateStringAttribute).toHaveBeenCalledWith(
      expect.objectContaining({
        collectionId: "customer",
        key: "email",
        required: false,
        size: 500,
      }),
    );
  });

  it("alterAttribute dispatches to updateRelationshipAttribute for a relationship attribute", async () => {
    await api.alterAttribute("customer", {
      key: "orders",
      type: "relationship",
      relatedCollection: "order",
      relationType: "oneToMany",
      twoWay: true,
      onDelete: "restrict",
    });
    expect(updateRelationshipAttribute).toHaveBeenCalledWith(
      expect.objectContaining({ collectionId: "customer", key: "orders", onDelete: "restrict" }),
    );
  });

  it("deleteAttribute/createIndex/deleteIndex/deleteCollection call through", async () => {
    await api.deleteAttribute("customer", "email");
    expect(deleteAttribute).toHaveBeenCalledWith({
      databaseId: "db-1",
      collectionId: "customer",
      key: "email",
    });

    await api.createIndex("customer", { key: "email_idx", type: "unique", attributes: ["email"] });
    expect(createIndex).toHaveBeenCalledWith({
      databaseId: "db-1",
      collectionId: "customer",
      key: "email_idx",
      type: "unique",
      attributes: ["email"],
    });

    await api.deleteIndex("customer", "email_idx");
    expect(deleteIndex).toHaveBeenCalledWith({
      databaseId: "db-1",
      collectionId: "customer",
      key: "email_idx",
    });

    await api.deleteCollection("customer");
    expect(deleteCollection).toHaveBeenCalledWith({ databaseId: "db-1", collectionId: "customer" });
  });
});

describe("createAdminApi — waiting for Appwrite's async attribute/index processing", () => {
  const fastApi = createAdminApi({} as never, "db-1", { pollIntervalMs: 1, timeoutMs: 20 });

  beforeEach(() => {
    getAttribute.mockReset().mockResolvedValue({ status: "available" });
    getIndex.mockReset().mockResolvedValue({ status: "available" });
  });

  it("createPlainAttribute polls getAttribute until it reports available", async () => {
    getAttribute
      .mockResolvedValueOnce({ status: "processing" })
      .mockResolvedValueOnce({ status: "available" });

    await fastApi.createPlainAttribute("customer", {
      key: "email",
      type: "string",
      required: true,
      array: false,
      size: 320,
    });

    expect(getAttribute).toHaveBeenCalledTimes(2);
    expect(getAttribute).toHaveBeenLastCalledWith({
      databaseId: "db-1",
      collectionId: "customer",
      key: "email",
    });
  });

  it("createIndex polls getIndex until it reports available", async () => {
    getIndex
      .mockResolvedValueOnce({ status: "processing" })
      .mockResolvedValueOnce({ status: "available" });

    await fastApi.createIndex("customer", {
      key: "email_idx",
      type: "unique",
      attributes: ["email"],
    });

    expect(getIndex).toHaveBeenCalledTimes(2);
  });

  it("rejects when an attribute lands in a failed/stuck status instead of available", async () => {
    getAttribute.mockResolvedValueOnce({ status: "stuck" });

    await expect(
      fastApi.createPlainAttribute("customer", {
        key: "email",
        type: "string",
        required: true,
        array: false,
        size: 320,
      }),
    ).rejects.toThrow(/failed to become available/i);
  });

  it("rejects after timing out if an attribute never becomes available", async () => {
    getAttribute.mockResolvedValue({ status: "processing" });

    await expect(
      fastApi.createPlainAttribute("customer", {
        key: "email",
        type: "string",
        required: true,
        array: false,
        size: 320,
      }),
    ).rejects.toThrow(/timed out/i);
  });
});
