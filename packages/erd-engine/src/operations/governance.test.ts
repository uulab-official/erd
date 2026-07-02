import { describe, expect, it } from "vitest";
import {
  addDictionaryEntry,
  createDomain,
  deleteDictionaryEntry,
  deleteDomain,
  updateDictionaryEntry,
  updateDomain,
  updateNamingRuleSet,
} from "./governance.js";
import { applyInverse } from "./apply.js";
import { emptyModel } from "./test-fixtures.js";

const EMAIL_DOMAIN = { id: "d1", name: "Email", type: "string" as const, length: 320 };
const ID_TERM = { id: "e1", logicalTerm: "Identifier", standardName: "id" };

describe("createDomain / deleteDomain", () => {
  it("creates a domain and its inverse removes it", () => {
    const before = emptyModel();
    const { model, operation } = createDomain(before, { domain: EMAIL_DOMAIN }, "user-1");
    expect(model.domains).toEqual([EMAIL_DOMAIN]);
    expect(applyInverse(model, operation)).toEqual(before);
  });

  it("rejects creating a domain with a duplicate id", () => {
    const before = createDomain(emptyModel(), { domain: EMAIL_DOMAIN }, "user-1").model;
    expect(() => createDomain(before, { domain: EMAIL_DOMAIN }, "user-1")).toThrow();
  });

  it("deletes a domain and its inverse restores it", () => {
    const before = createDomain(emptyModel(), { domain: EMAIL_DOMAIN }, "user-1").model;
    const { model, operation } = deleteDomain(before, { domainId: "d1" }, "user-1");
    expect(model.domains).toEqual([]);
    expect(applyInverse(model, operation)).toEqual(before);
  });

  it("rejects deleting a domain still assigned to an attribute", () => {
    const withDomain = createDomain(emptyModel(), { domain: EMAIL_DOMAIN }, "user-1").model;
    const withEntity = {
      ...withDomain,
      entities: [
        {
          id: "customer",
          logicalName: "Customer",
          physicalName: "customer",
          tags: [],
          attributes: [
            {
              id: "email",
              name: "email",
              logicalName: "Email",
              type: "string" as const,
              nullable: false,
              isPrimaryKey: false,
              isForeignKey: false,
              isUnique: false,
              domainId: "d1",
            },
          ],
          indexes: [],
          ui: { x: 0, y: 0 },
        },
      ],
    };
    expect(() => deleteDomain(withEntity, { domainId: "d1" }, "user-1")).toThrow(
      "deleteDomainCascade",
    );
  });
});

describe("updateDomain", () => {
  it("updates only the given fields and its inverse restores them", () => {
    const before = createDomain(emptyModel(), { domain: EMAIL_DOMAIN }, "user-1").model;
    const { model, operation } = updateDomain(
      before,
      { domainId: "d1", changes: { length: 255 } },
      "user-1",
    );
    expect(model.domains?.[0]).toMatchObject({ length: 255, name: "Email" });
    expect(applyInverse(model, operation)).toEqual(before);
  });
});

describe("addDictionaryEntry / updateDictionaryEntry / deleteDictionaryEntry", () => {
  it("adds an entry and its inverse removes it", () => {
    const before = emptyModel();
    const { model, operation } = addDictionaryEntry(before, { entry: ID_TERM }, "user-1");
    expect(model.dictionary).toEqual([ID_TERM]);
    expect(applyInverse(model, operation)).toEqual(before);
  });

  it("updates an entry and its inverse restores it", () => {
    const before = addDictionaryEntry(emptyModel(), { entry: ID_TERM }, "user-1").model;
    const { model, operation } = updateDictionaryEntry(
      before,
      { entryId: "e1", changes: { standardName: "identifier" } },
      "user-1",
    );
    expect(model.dictionary?.[0]?.standardName).toBe("identifier");
    expect(applyInverse(model, operation)).toEqual(before);
  });

  it("deletes an entry and its inverse restores it", () => {
    const before = addDictionaryEntry(emptyModel(), { entry: ID_TERM }, "user-1").model;
    const { model, operation } = deleteDictionaryEntry(before, { entryId: "e1" }, "user-1");
    expect(model.dictionary).toEqual([]);
    expect(applyInverse(model, operation)).toEqual(before);
  });
});

describe("updateNamingRuleSet", () => {
  it("replaces the naming rules and its inverse restores the previous value", () => {
    const before = emptyModel();
    const rules = { case: "snake" as const, reservedWords: ["order"], abbreviations: {} };
    const { model, operation } = updateNamingRuleSet(before, { namingRules: rules }, "user-1");
    expect(model.namingRules).toEqual(rules);
    expect(applyInverse(model, operation)).toEqual(before);
  });

  it("can clear the naming rules by passing undefined, and its inverse restores them", () => {
    const rules = { case: "snake" as const, reservedWords: [], abbreviations: {} };
    const before = updateNamingRuleSet(emptyModel(), { namingRules: rules }, "user-1").model;
    const { model, operation } = updateNamingRuleSet(before, { namingRules: undefined }, "user-1");
    expect(model.namingRules).toBeUndefined();
    expect(applyInverse(model, operation)).toEqual(before);
  });
});
