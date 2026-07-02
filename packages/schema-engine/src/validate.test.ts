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
});
