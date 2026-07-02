import { describe, expect, it } from "vitest";
import { parseAppwriteJson } from "./appwriteJson.js";
import { fromNativeSchema } from "./fromNativeSchema.js";

const SAMPLE_APPWRITE_JSON = JSON.stringify({
  projectId: "shop",
  collections: [
    {
      $id: "customer",
      name: "Customer",
      attributes: [
        { key: "email", type: "string", required: true, array: false, size: 320, default: null },
        { key: "age", type: "integer", required: false, array: false, min: 0, max: 150 },
        {
          key: "orders",
          type: "relationship",
          relatedCollection: "order",
          relationType: "oneToMany",
          twoWay: true,
          onDelete: "cascade",
          side: "parent",
        },
      ],
      indexes: [{ key: "email_idx", type: "unique", attributes: ["email"], orders: ["ASC"] }],
    },
    {
      $id: "order",
      name: "Order",
      attributes: [{ key: "total", type: "float", required: true, array: false }],
      indexes: [],
    },
  ],
});

describe("parseAppwriteJson", () => {
  it("parses collections, attributes, and indexes from an appwrite.json export", () => {
    const schema = parseAppwriteJson(SAMPLE_APPWRITE_JSON);
    expect(schema.collections.map((c) => c.id)).toEqual(["customer", "order"]);

    const customer = schema.collections[0]!;
    expect(customer.attributes[0]).toMatchObject({ key: "email", type: "string", size: 320 });
    expect(customer.indexes[0]).toEqual({
      key: "email_idx",
      type: "unique",
      attributes: ["email"],
    });
  });

  it("parses a relationship attribute with defaults for missing fields", () => {
    const schema = parseAppwriteJson(SAMPLE_APPWRITE_JSON);
    const relationship = schema.collections[0]!.attributes.find((a) => a.type === "relationship");
    expect(relationship).toMatchObject({
      key: "orders",
      relatedCollection: "order",
      relationType: "oneToMany",
      twoWay: true,
      onDelete: "cascade",
    });
  });

  it("feeds straight into fromNativeSchema to produce a usable Model", () => {
    const model = fromNativeSchema(parseAppwriteJson(SAMPLE_APPWRITE_JSON));
    expect(model.entities.map((e) => e.id)).toEqual(["customer", "order"]);
    expect(model.relationships).toHaveLength(1);
    expect(model.relationships[0]).toMatchObject({
      sourceEntityId: "customer",
      targetEntityId: "order",
      cardinality: "one-to-many",
    });
  });

  it("rejects invalid JSON", () => {
    expect(() => parseAppwriteJson("not json")).toThrow("Not valid JSON");
  });

  it("rejects JSON missing a collections array", () => {
    expect(() => parseAppwriteJson(JSON.stringify({ projectId: "x" }))).toThrow("collections");
  });

  it("throws on a relationship attribute missing relatedCollection", () => {
    const broken = JSON.stringify({
      collections: [
        {
          $id: "a",
          name: "A",
          attributes: [{ key: "rel", type: "relationship" }],
        },
      ],
    });
    expect(() => parseAppwriteJson(broken)).toThrow("relatedCollection");
  });
});
