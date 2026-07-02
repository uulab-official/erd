import { describe, expect, it } from "vitest";
import { validateForPostgres } from "./validate.js";
import { shopModel } from "./test-fixtures.js";

describe("validateForPostgres", () => {
  it("passes a clean model with no issues", () => {
    expect(validateForPostgres(shopModel())).toEqual([]);
  });

  it("errors on a table name exceeding PostgreSQL's 63-character identifier limit", () => {
    const model = shopModel();
    model.entities[0]!.physicalName = "a".repeat(64);
    const issues = validateForPostgres(model);
    expect(issues).toEqual([
      expect.objectContaining({ severity: "error", code: "postgres-identifier-too-long" }),
    ]);
  });

  it("errors on a column name exceeding the limit", () => {
    const model = shopModel();
    model.entities[0]!.attributes[0]!.name = "b".repeat(64);
    const issues = validateForPostgres(model);
    expect(issues).toEqual([
      expect.objectContaining({ severity: "error", code: "postgres-identifier-too-long" }),
    ]);
  });
});
