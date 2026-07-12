import { describe, expect, it } from "vitest";
import { validateModel } from "./validate.js";
import type { Model } from "./types.js";

function emptyModel(): Model {
  return {
    id: "model-1",
    name: "Test",
    adapter: "postgresql",
    entities: [],
    relationships: [],
    views: [],
    sequences: [],
    enums: [],
  };
}

describe("validateModel", () => {
  it("flags an entity with no primary key", () => {
    const model = emptyModel();
    model.entities.push({
      id: "e1",
      logicalName: "Customer",
      physicalName: "customer",
      tags: [],
      attributes: [
        {
          id: "a1",
          name: "name",
          logicalName: "Name",
          type: "string",
          nullable: false,
          isPrimaryKey: false,
          isForeignKey: false,
          isUnique: false,
        },
      ],
      indexes: [],
      ui: { x: 0, y: 0 },
    });

    const issues = validateModel(model);
    expect(issues.some((i) => i.code === "no-primary-key")).toBe(true);
    expect(issues.some((i) => i.code === "orphan-entity")).toBe(true);
  });

  it("returns no issues for a valid connected model", () => {
    const model = emptyModel();
    model.entities.push(
      {
        id: "e1",
        logicalName: "Customer",
        physicalName: "customer",
        tags: [],
        attributes: [
          {
            id: "a1",
            name: "id",
            logicalName: "ID",
            type: "uuid",
            nullable: false,
            isPrimaryKey: true,
            isForeignKey: false,
            isUnique: true,
          },
        ],
        indexes: [],
        ui: { x: 0, y: 0 },
      },
      {
        id: "e2",
        logicalName: "Purchase",
        physicalName: "purchase",
        tags: [],
        attributes: [
          {
            id: "a2",
            name: "id",
            logicalName: "ID",
            type: "uuid",
            nullable: false,
            isPrimaryKey: true,
            isForeignKey: false,
            isUnique: true,
          },
          {
            id: "a3",
            name: "customer_id",
            logicalName: "Customer ID",
            type: "uuid",
            nullable: false,
            isPrimaryKey: false,
            isForeignKey: true,
            isUnique: false,
          },
        ],
        indexes: [],
        ui: { x: 0, y: 0 },
      },
    );
    model.relationships.push({
      id: "r1",
      sourceEntityId: "e1",
      targetEntityId: "e2",
      cardinality: "one-to-many",
      kind: "non-identifying",
      optionality: "mandatory",
      sourceAttributeIds: ["a1"],
      targetAttributeIds: ["a3"],
    });

    expect(validateModel(model)).toEqual([]);
  });

  it("flags a relationship whose source/target attribute types don't match", () => {
    const model = emptyModel();
    model.entities.push(
      {
        id: "e1",
        logicalName: "Customer",
        physicalName: "customer",
        tags: [],
        attributes: [
          {
            id: "a1",
            name: "id",
            logicalName: "ID",
            type: "integer",
            nullable: false,
            isPrimaryKey: true,
            isForeignKey: false,
            isUnique: true,
          },
        ],
        indexes: [],
        ui: { x: 0, y: 0 },
      },
      {
        id: "e2",
        logicalName: "Purchase",
        physicalName: "purchase",
        tags: [],
        attributes: [
          {
            id: "a2",
            name: "id",
            logicalName: "ID",
            type: "uuid",
            nullable: false,
            isPrimaryKey: true,
            isForeignKey: false,
            isUnique: true,
          },
          {
            id: "a3",
            name: "customer_id",
            logicalName: "Customer ID",
            // Drifted out of sync with e1.a1's "integer" — e.g. via changeAttributeType,
            // which has no guard against retyping an attribute already used as an FK.
            type: "string",
            nullable: false,
            isPrimaryKey: false,
            isForeignKey: true,
            isUnique: false,
          },
        ],
        indexes: [],
        ui: { x: 0, y: 0 },
      },
    );
    model.relationships.push({
      id: "r1",
      sourceEntityId: "e1",
      targetEntityId: "e2",
      cardinality: "one-to-many",
      kind: "non-identifying",
      optionality: "mandatory",
      sourceAttributeIds: ["a1"],
      targetAttributeIds: ["a3"],
    });

    const issues = validateModel(model);
    const mismatch = issues.find((i) => i.code === "relationship-attribute-type-mismatch");
    expect(mismatch).toMatchObject({ severity: "error", entityId: "e2", attributeId: "a3" });
  });

  it("does not flag a relationship whose attribute ids are dangling references", () => {
    const model = emptyModel();
    model.entities.push(
      {
        id: "e1",
        logicalName: "Customer",
        physicalName: "customer",
        tags: [],
        attributes: [],
        indexes: [],
        ui: { x: 0, y: 0 },
      },
      {
        id: "e2",
        logicalName: "Purchase",
        physicalName: "purchase",
        tags: [],
        attributes: [],
        indexes: [],
        ui: { x: 0, y: 0 },
      },
    );
    model.relationships.push({
      id: "r1",
      sourceEntityId: "e1",
      targetEntityId: "e2",
      cardinality: "one-to-many",
      kind: "non-identifying",
      optionality: "mandatory",
      sourceAttributeIds: ["missing-source"],
      targetAttributeIds: ["missing-target"],
    });

    expect(
      validateModel(model).some((i) => i.code === "relationship-attribute-type-mismatch"),
    ).toBe(false);
  });

  it("flags a duplicate index name", () => {
    const model = emptyModel();
    model.entities.push({
      id: "e1",
      logicalName: "Customer",
      physicalName: "customer",
      tags: [],
      attributes: [
        {
          id: "a1",
          name: "id",
          logicalName: "ID",
          type: "uuid",
          nullable: false,
          isPrimaryKey: true,
          isForeignKey: false,
          isUnique: true,
        },
        {
          id: "a2",
          name: "email",
          logicalName: "Email",
          type: "string",
          nullable: false,
          isPrimaryKey: false,
          isForeignKey: false,
          isUnique: true,
        },
      ],
      indexes: [
        { id: "i1", name: "idx_dup", attributeIds: ["a1"], unique: false },
        { id: "i2", name: "idx_dup", attributeIds: ["a2"], unique: false },
      ],
      ui: { x: 0, y: 0 },
    });

    expect(validateModel(model).map((i) => i.code)).toContain("duplicate-index-name");
  });

  it("flags two indexes covering the same columns", () => {
    const model = emptyModel();
    model.entities.push({
      id: "e1",
      logicalName: "Customer",
      physicalName: "customer",
      tags: [],
      attributes: [
        {
          id: "a1",
          name: "id",
          logicalName: "ID",
          type: "uuid",
          nullable: false,
          isPrimaryKey: true,
          isForeignKey: false,
          isUnique: true,
        },
      ],
      indexes: [
        { id: "i1", name: "idx_a", attributeIds: ["a1"], unique: false },
        { id: "i2", name: "idx_b", attributeIds: ["a1"], unique: true },
      ],
      ui: { x: 0, y: 0 },
    });

    expect(validateModel(model).map((i) => i.code)).toContain("duplicate-index-columns");
  });

  it("flags an entity physical name that is a reserved word", () => {
    const model = emptyModel();
    model.entities.push({
      id: "e1",
      logicalName: "Table",
      physicalName: "table",
      tags: [],
      attributes: [
        {
          id: "a1",
          name: "id",
          logicalName: "ID",
          type: "uuid",
          nullable: false,
          isPrimaryKey: true,
          isForeignKey: false,
          isUnique: true,
        },
      ],
      indexes: [],
      ui: { x: 0, y: 0 },
    });

    const issues = validateModel(model);
    expect(issues).toContainEqual(
      expect.objectContaining({ code: "reserved-word", entityId: "e1" }),
    );
  });

  it("flags an attribute name that is a reserved word", () => {
    const model = emptyModel();
    model.entities.push({
      id: "e1",
      logicalName: "Customer",
      physicalName: "customer",
      tags: [],
      attributes: [
        {
          id: "a1",
          name: "select",
          logicalName: "Select",
          type: "string",
          nullable: false,
          isPrimaryKey: true,
          isForeignKey: false,
          isUnique: true,
        },
      ],
      indexes: [],
      ui: { x: 0, y: 0 },
    });

    const issues = validateModel(model);
    expect(issues).toContainEqual(
      expect.objectContaining({ code: "reserved-word", attributeId: "a1" }),
    );
  });

  it("honors a custom reserved word list instead of the default", () => {
    const model = emptyModel();
    model.entities.push({
      id: "e1",
      logicalName: "Widget",
      physicalName: "widget",
      tags: [],
      attributes: [
        {
          id: "a1",
          name: "id",
          logicalName: "ID",
          type: "uuid",
          nullable: false,
          isPrimaryKey: true,
          isForeignKey: false,
          isUnique: true,
        },
      ],
      indexes: [],
      ui: { x: 0, y: 0 },
    });

    expect(validateModel(model, ["widget"]).map((i) => i.code)).toContain("reserved-word");
    expect(validateModel(model, ["nothing-matches"]).map((i) => i.code)).not.toContain(
      "reserved-word",
    );
  });

  it("flags a circular identifying relationship", () => {
    const model = emptyModel();
    const makeEntity = (id: string) => ({
      id,
      logicalName: id,
      physicalName: id,
      tags: [],
      attributes: [
        {
          id: `${id}_id`,
          name: "id",
          logicalName: "ID",
          type: "uuid" as const,
          nullable: false,
          isPrimaryKey: true,
          isForeignKey: false,
          isUnique: true,
        },
      ],
      indexes: [],
      ui: { x: 0, y: 0 },
    });
    model.entities.push(makeEntity("a"), makeEntity("b"), makeEntity("c"));
    const identifying = (source: string, target: string, id: string) => ({
      id,
      sourceEntityId: source,
      targetEntityId: target,
      cardinality: "one-to-many" as const,
      kind: "identifying" as const,
      optionality: "mandatory" as const,
      sourceAttributeIds: [`${source}_id`],
      targetAttributeIds: [`${target}_id`],
    });
    model.relationships.push(
      identifying("a", "b", "r1"),
      identifying("b", "c", "r2"),
      identifying("c", "a", "r3"),
    );

    const issues = validateModel(model);
    expect(issues.map((i) => i.code)).toContain("circular-identifying-relationship");
  });

  it("does not flag a non-identifying cycle", () => {
    const model = emptyModel();
    const makeEntity = (id: string) => ({
      id,
      logicalName: id,
      physicalName: id,
      tags: [],
      attributes: [
        {
          id: `${id}_id`,
          name: "id",
          logicalName: "ID",
          type: "uuid" as const,
          nullable: false,
          isPrimaryKey: true,
          isForeignKey: false,
          isUnique: true,
        },
      ],
      indexes: [],
      ui: { x: 0, y: 0 },
    });
    model.entities.push(makeEntity("a"), makeEntity("b"));
    model.relationships.push(
      {
        id: "r1",
        sourceEntityId: "a",
        targetEntityId: "b",
        cardinality: "one-to-many",
        kind: "non-identifying",
        optionality: "optional",
        sourceAttributeIds: ["a_id"],
        targetAttributeIds: ["b_id"],
      },
      {
        id: "r2",
        sourceEntityId: "b",
        targetEntityId: "a",
        cardinality: "one-to-many",
        kind: "non-identifying",
        optionality: "optional",
        sourceAttributeIds: ["b_id"],
        targetAttributeIds: ["a_id"],
      },
    );

    expect(validateModel(model).map((i) => i.code)).not.toContain(
      "circular-identifying-relationship",
    );
  });

  it("merges a Model's own namingRules.reservedWords with the built-in default list", () => {
    const model = emptyModel();
    model.namingRules = { case: "snake", reservedWords: ["widget"], abbreviations: {} };
    model.entities.push({
      id: "e1",
      logicalName: "Widget",
      physicalName: "widget",
      tags: [],
      attributes: [
        {
          id: "a1",
          name: "id",
          logicalName: "ID",
          type: "uuid",
          nullable: false,
          isPrimaryKey: true,
          isForeignKey: false,
          isUnique: true,
        },
      ],
      indexes: [],
      ui: { x: 0, y: 0 },
    });

    expect(validateModel(model).map((i) => i.code)).toContain("reserved-word");
  });

  it("flags a physical name that violates the configured case", () => {
    const model = emptyModel();
    model.namingRules = { case: "snake", reservedWords: [], abbreviations: {} };
    model.entities.push({
      id: "e1",
      logicalName: "Customer",
      physicalName: "CustomerTable",
      tags: [],
      attributes: [
        {
          id: "a1",
          name: "customerId",
          logicalName: "ID",
          type: "uuid",
          nullable: false,
          isPrimaryKey: true,
          isForeignKey: false,
          isUnique: true,
        },
      ],
      indexes: [],
      ui: { x: 0, y: 0 },
    });

    const codes = validateModel(model).map((i) => i.code);
    expect(codes.filter((c) => c === "naming-convention-violation")).toHaveLength(2);
  });

  it("flags a physical name missing the configured prefix/suffix", () => {
    const model = emptyModel();
    model.namingRules = {
      case: "snake",
      entityPrefix: "tbl_",
      reservedWords: [],
      abbreviations: {},
    };
    model.entities.push({
      id: "e1",
      logicalName: "Customer",
      physicalName: "customer",
      tags: [],
      attributes: [
        {
          id: "a1",
          name: "id",
          logicalName: "ID",
          type: "uuid",
          nullable: false,
          isPrimaryKey: true,
          isForeignKey: false,
          isUnique: true,
        },
      ],
      indexes: [],
      ui: { x: 0, y: 0 },
    });

    expect(validateModel(model).map((i) => i.code)).toContain("naming-convention-violation");
  });

  it("does not check naming conventions when no NamingRuleSet is configured", () => {
    const model = emptyModel();
    model.entities.push({
      id: "e1",
      logicalName: "Customer",
      physicalName: "CustomerTable",
      tags: [],
      attributes: [
        {
          id: "a1",
          name: "id",
          logicalName: "ID",
          type: "uuid",
          nullable: false,
          isPrimaryKey: true,
          isForeignKey: false,
          isUnique: true,
        },
      ],
      indexes: [],
      ui: { x: 0, y: 0 },
    });

    expect(validateModel(model).map((i) => i.code)).not.toContain("naming-convention-violation");
  });

  it("suggests a configured abbreviation for a spelled-out word", () => {
    const model = emptyModel();
    model.namingRules = {
      case: "snake",
      reservedWords: [],
      abbreviations: { identifier: "id" },
    };
    model.entities.push({
      id: "e1",
      logicalName: "Customer",
      physicalName: "customer",
      tags: [],
      attributes: [
        {
          id: "a1",
          name: "customer_identifier",
          logicalName: "ID",
          type: "uuid",
          nullable: false,
          isPrimaryKey: true,
          isForeignKey: false,
          isUnique: true,
        },
      ],
      indexes: [],
      ui: { x: 0, y: 0 },
    });

    const issue = validateModel(model).find((i) => i.code === "abbreviation-suggested");
    expect(issue?.message).toContain('abbreviate "identifier" as "id"');
  });

  it("suggests the Dictionary's standard term when a name uses a different spelling", () => {
    const model = emptyModel();
    model.dictionary = [{ id: "d1", logicalTerm: "customer", standardName: "Cust" }];
    model.entities.push({
      id: "e1",
      logicalName: "Order",
      physicalName: "order",
      tags: [],
      attributes: [
        {
          id: "a1",
          name: "customer_id",
          logicalName: "Customer ID",
          type: "uuid",
          nullable: false,
          isPrimaryKey: true,
          isForeignKey: false,
          isUnique: true,
        },
      ],
      indexes: [],
      ui: { x: 0, y: 0 },
    });

    const issue = validateModel(model).find((i) => i.code === "dictionary-term-suggested");
    expect(issue?.message).toContain('standard term "Cust" instead of "customer"');
  });

  it("does not flag a name that already uses the Dictionary's exact standard spelling", () => {
    const model = emptyModel();
    model.dictionary = [{ id: "d1", logicalTerm: "customer", standardName: "Cust" }];
    model.entities.push({
      id: "e1",
      logicalName: "Order",
      physicalName: "order",
      tags: [],
      attributes: [
        {
          id: "a1",
          name: "Cust_id",
          logicalName: "Customer ID",
          type: "uuid",
          nullable: false,
          isPrimaryKey: true,
          isForeignKey: false,
          isUnique: true,
        },
      ],
      indexes: [],
      ui: { x: 0, y: 0 },
    });

    expect(validateModel(model).map((i) => i.code)).not.toContain("dictionary-term-suggested");
  });

  it("flags an attribute referencing a missing domain", () => {
    const model = emptyModel();
    model.entities.push({
      id: "e1",
      logicalName: "Customer",
      physicalName: "customer",
      tags: [],
      attributes: [
        {
          id: "a1",
          name: "id",
          logicalName: "ID",
          type: "uuid",
          nullable: false,
          isPrimaryKey: true,
          isForeignKey: false,
          isUnique: true,
        },
        {
          id: "a2",
          name: "email",
          logicalName: "Email",
          type: "string",
          nullable: false,
          isPrimaryKey: false,
          isForeignKey: false,
          isUnique: false,
          domainId: "missing-domain",
        },
      ],
      indexes: [],
      ui: { x: 0, y: 0 },
    });

    const issues = validateModel(model);
    expect(issues).toContainEqual(
      expect.objectContaining({ code: "domain-not-found", attributeId: "a2" }),
    );
  });

  it("flags an attribute whose type has drifted from its assigned domain", () => {
    const model = emptyModel();
    model.domains = [{ id: "d1", name: "Email", type: "string", length: 320 }];
    model.entities.push({
      id: "e1",
      logicalName: "Customer",
      physicalName: "customer",
      tags: [],
      attributes: [
        {
          id: "a1",
          name: "id",
          logicalName: "ID",
          type: "uuid",
          nullable: false,
          isPrimaryKey: true,
          isForeignKey: false,
          isUnique: true,
        },
        {
          id: "a2",
          name: "email",
          logicalName: "Email",
          type: "string",
          length: 100,
          nullable: false,
          isPrimaryKey: false,
          isForeignKey: false,
          isUnique: false,
          domainId: "d1",
        },
      ],
      indexes: [],
      ui: { x: 0, y: 0 },
    });

    const issues = validateModel(model);
    expect(issues).toContainEqual(
      expect.objectContaining({ code: "domain-drift", attributeId: "a2" }),
    );
  });

  it("does not flag an attribute whose type matches its assigned domain", () => {
    const model = emptyModel();
    model.domains = [{ id: "d1", name: "Email", type: "string", length: 320 }];
    model.entities.push({
      id: "e1",
      logicalName: "Customer",
      physicalName: "customer",
      tags: [],
      attributes: [
        {
          id: "a1",
          name: "id",
          logicalName: "ID",
          type: "uuid",
          nullable: false,
          isPrimaryKey: true,
          isForeignKey: false,
          isUnique: true,
        },
        {
          id: "a2",
          name: "email",
          logicalName: "Email",
          type: "string",
          length: 320,
          nullable: false,
          isPrimaryKey: false,
          isForeignKey: false,
          isUnique: false,
          domainId: "d1",
        },
      ],
      indexes: [],
      ui: { x: 0, y: 0 },
    });

    expect(validateModel(model).map((i) => i.code)).not.toContain("domain-drift");
  });

  it("warns on an enum-typed attribute with no enumId link", () => {
    const model = emptyModel();
    model.entities.push({
      id: "e1",
      logicalName: "Order",
      physicalName: "order",
      tags: [],
      attributes: [
        {
          id: "a1",
          name: "status",
          logicalName: "Status",
          type: "enum",
          nullable: false,
          isPrimaryKey: false,
          isForeignKey: false,
          isUnique: false,
        },
      ],
      indexes: [],
      ui: { x: 0, y: 0 },
    });

    const issues = validateModel(model);
    expect(issues).toContainEqual(
      expect.objectContaining({ code: "enum-not-linked", attributeId: "a1", severity: "warning" }),
    );
  });

  it("flags an enum-typed attribute referencing a missing Enum", () => {
    const model = emptyModel();
    model.entities.push({
      id: "e1",
      logicalName: "Order",
      physicalName: "order",
      tags: [],
      attributes: [
        {
          id: "a1",
          name: "status",
          logicalName: "Status",
          type: "enum",
          enumId: "missing-enum",
          nullable: false,
          isPrimaryKey: false,
          isForeignKey: false,
          isUnique: false,
        },
      ],
      indexes: [],
      ui: { x: 0, y: 0 },
    });

    const issues = validateModel(model);
    expect(issues).toContainEqual(
      expect.objectContaining({ code: "enum-not-found", attributeId: "a1", severity: "error" }),
    );
  });

  it("does not flag an enum-typed attribute correctly linked to a real Enum", () => {
    const model = emptyModel();
    model.enums = [{ id: "e1", name: "OrderStatus", values: ["pending"] }];
    model.entities.push({
      id: "e1",
      logicalName: "Order",
      physicalName: "order",
      tags: [],
      attributes: [
        {
          id: "a1",
          name: "status",
          logicalName: "Status",
          type: "enum",
          enumId: "e1",
          nullable: false,
          isPrimaryKey: false,
          isForeignKey: false,
          isUnique: false,
        },
      ],
      indexes: [],
      ui: { x: 0, y: 0 },
    });

    const codes = validateModel(model).map((i) => i.code);
    expect(codes).not.toContain("enum-not-linked");
    expect(codes).not.toContain("enum-not-found");
  });

  it("flags an attribute whose default's JS type doesn't match its declared type", () => {
    const model = emptyModel();
    model.entities.push({
      id: "e1",
      logicalName: "Order",
      physicalName: "order",
      tags: [],
      attributes: [
        {
          id: "a1",
          name: "quantity",
          logicalName: "Quantity",
          // Drifted out of sync — e.g. via changeAttributeType, which has no guard
          // against retyping an attribute out from under its own default.
          type: "integer",
          default: true,
          nullable: false,
          isPrimaryKey: false,
          isForeignKey: false,
          isUnique: false,
        },
      ],
      indexes: [],
      ui: { x: 0, y: 0 },
    });

    const issues = validateModel(model);
    expect(issues).toContainEqual(
      expect.objectContaining({
        code: "attribute-default-type-mismatch",
        attributeId: "a1",
        severity: "error",
      }),
    );
  });

  it("does not flag a default whose JS type matches its declared type", () => {
    const model = emptyModel();
    model.entities.push({
      id: "e1",
      logicalName: "Order",
      physicalName: "order",
      tags: [],
      attributes: [
        {
          id: "a1",
          name: "quantity",
          logicalName: "Quantity",
          type: "integer",
          default: 1,
          nullable: false,
          isPrimaryKey: false,
          isForeignKey: false,
          isUnique: false,
        },
        {
          id: "a2",
          name: "active",
          logicalName: "Active",
          type: "boolean",
          default: true,
          nullable: false,
          isPrimaryKey: false,
          isForeignKey: false,
          isUnique: false,
        },
      ],
      indexes: [],
      ui: { x: 0, y: 0 },
    });

    expect(validateModel(model).map((i) => i.code)).not.toContain(
      "attribute-default-type-mismatch",
    );
  });

  it("flags an enum-typed attribute whose default is no longer one of the enum's values", () => {
    const model = emptyModel();
    model.enums = [{ id: "e1", name: "OrderStatus", values: ["pending", "shipped"] }];
    model.entities.push({
      id: "e1",
      logicalName: "Order",
      physicalName: "order",
      tags: [],
      attributes: [
        {
          id: "a1",
          name: "status",
          logicalName: "Status",
          type: "enum",
          enumId: "e1",
          // Stale — e.g. left over after UpdateEnumValues dropped "cancelled", which has
          // no guard against a still-referenced default.
          default: "cancelled",
          nullable: false,
          isPrimaryKey: false,
          isForeignKey: false,
          isUnique: false,
        },
      ],
      indexes: [],
      ui: { x: 0, y: 0 },
    });

    const issues = validateModel(model);
    expect(issues).toContainEqual(
      expect.objectContaining({
        code: "enum-default-not-a-member",
        attributeId: "a1",
        severity: "error",
      }),
    );
  });

  it("does not flag an enum-typed attribute whose default is a current enum value", () => {
    const model = emptyModel();
    model.enums = [{ id: "e1", name: "OrderStatus", values: ["pending", "shipped"] }];
    model.entities.push({
      id: "e1",
      logicalName: "Order",
      physicalName: "order",
      tags: [],
      attributes: [
        {
          id: "a1",
          name: "status",
          logicalName: "Status",
          type: "enum",
          enumId: "e1",
          default: "pending",
          nullable: false,
          isPrimaryKey: false,
          isForeignKey: false,
          isUnique: false,
        },
      ],
      indexes: [],
      ui: { x: 0, y: 0 },
    });

    expect(validateModel(model).map((i) => i.code)).not.toContain("enum-default-not-a-member");
  });

  it("flags duplicate domain names", () => {
    const model = emptyModel();
    model.domains = [
      { id: "d1", name: "Email", type: "string", length: 320 },
      { id: "d2", name: "Email", type: "string", length: 320 },
    ];
    expect(validateModel(model).map((i) => i.code)).toContain("duplicate-domain-name");
  });

  it("flags duplicate enum names", () => {
    const model = emptyModel();
    model.enums = [
      { id: "e1", name: "OrderStatus", values: ["pending"] },
      { id: "e2", name: "OrderStatus", values: ["shipped"] },
    ];
    expect(validateModel(model).map((i) => i.code)).toContain("duplicate-enum-name");
  });

  it("flags duplicate subject area names", () => {
    const model = emptyModel();
    model.subjectAreas = [
      { id: "sa1", name: "Sales", entityIds: [] },
      { id: "sa2", name: "Sales", entityIds: [] },
    ];
    expect(validateModel(model).map((i) => i.code)).toContain("duplicate-subject-area-name");
  });

  it("does not flag unique domain/enum/subject area names", () => {
    const model = emptyModel();
    model.domains = [{ id: "d1", name: "Email", type: "string", length: 320 }];
    model.enums = [{ id: "e1", name: "OrderStatus", values: ["pending"] }];
    model.subjectAreas = [{ id: "sa1", name: "Sales", entityIds: [] }];
    const codes = validateModel(model).map((i) => i.code);
    expect(codes).not.toContain("duplicate-domain-name");
    expect(codes).not.toContain("duplicate-enum-name");
    expect(codes).not.toContain("duplicate-subject-area-name");
  });

  it("flags duplicate dictionary terms, case-insensitively", () => {
    const model = emptyModel();
    model.dictionary = [
      { id: "e1", logicalTerm: "Identifier", standardName: "id" },
      { id: "e2", logicalTerm: "identifier", standardName: "ID" },
    ];
    expect(validateModel(model).map((i) => i.code)).toContain("duplicate-dictionary-term");
  });

  it("does not flag unique dictionary terms", () => {
    const model = emptyModel();
    model.dictionary = [
      { id: "e1", logicalTerm: "Identifier", standardName: "id" },
      { id: "e2", logicalTerm: "Customer", standardName: "Cust" },
    ];
    expect(validateModel(model).map((i) => i.code)).not.toContain("duplicate-dictionary-term");
  });

  it("flags duplicate sequence names", () => {
    const model = emptyModel();
    model.sequences = [
      { id: "s1", name: "order_seq", start: 1, increment: 1 },
      { id: "s2", name: "order_seq", start: 1, increment: 1 },
    ];
    const codes = validateModel(model).map((i) => i.code);
    expect(codes).toContain("duplicate-sequence-name");
  });

  it("flags duplicate view names", () => {
    const model = emptyModel();
    model.views = [
      { id: "v1", name: "active_orders", sql: "SELECT 1" },
      { id: "v2", name: "active_orders", sql: "SELECT 2" },
    ];
    const codes = validateModel(model).map((i) => i.code);
    expect(codes).toContain("duplicate-view-name");
  });

  it("flags a view with no sql", () => {
    const model = emptyModel();
    model.views = [{ id: "v1", name: "active_orders" }];
    const issues = validateModel(model);
    expect(issues).toContainEqual(
      expect.objectContaining({ code: "view-missing-sql", severity: "warning" }),
    );
  });

  it("does not flag a view that has sql, or unique sequence/view names", () => {
    const model = emptyModel();
    model.sequences = [{ id: "s1", name: "order_seq", start: 1, increment: 1 }];
    model.views = [{ id: "v1", name: "active_orders", sql: "SELECT 1" }];
    const codes = validateModel(model).map((i) => i.code);
    expect(codes).not.toContain("duplicate-sequence-name");
    expect(codes).not.toContain("duplicate-view-name");
    expect(codes).not.toContain("view-missing-sql");
  });
});
