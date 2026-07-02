import { describe, expect, it } from "vitest";
import { describeHistoryEntry } from "./describe.js";
import { createEntity } from "./entity.js";
import { deleteEntityCascade } from "./transaction.js";
import { customerEntity, emptyModel } from "./test-fixtures.js";

describe("describeHistoryEntry", () => {
  it("labels a single Operation by its type", () => {
    const { operation } = createEntity(emptyModel(), customerEntity(), "user-1");
    expect(describeHistoryEntry(operation)).toBe("Create entity");
  });

  it("labels a Transaction with its own label", () => {
    const created = createEntity(emptyModel(), customerEntity(), "user-1");
    const { transaction } = deleteEntityCascade(created.model, "customer", "user-1");
    expect(describeHistoryEntry(transaction)).toBe(transaction.label);
  });
});
