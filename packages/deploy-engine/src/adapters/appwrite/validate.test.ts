import { describe, expect, it } from "vitest";
import { validateForAppwrite } from "./validate.js";
import { shopModel } from "./test-fixtures.js";

describe("validateForAppwrite", () => {
  it("passes a clean model with no issues", () => {
    expect(validateForAppwrite(shopModel())).toEqual([]);
  });

  it("errors on an attribute name colliding with an Appwrite system field", () => {
    const model = shopModel();
    model.entities[0]!.attributes.push({
      id: "created",
      name: "$createdAt",
      logicalName: "Created",
      type: "datetime",
      nullable: true,
      isPrimaryKey: false,
      isForeignKey: false,
      isUnique: false,
    });
    const issues = validateForAppwrite(model);
    expect(issues).toEqual([
      expect.objectContaining({ severity: "error", code: "appwrite-reserved-key" }),
    ]);
  });

  it("warns on a composite primary key", () => {
    const model = shopModel();
    model.entities[1]!.attributes.push({
      ...model.entities[1]!.attributes[1]!,
      id: "id2",
      name: "id2",
      isPrimaryKey: true,
      isForeignKey: false,
    });
    const issues = validateForAppwrite(model);
    expect(issues).toEqual([
      expect.objectContaining({ severity: "warning", code: "appwrite-composite-pk" }),
    ]);
  });
});
