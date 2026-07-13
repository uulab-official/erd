import { describe, expect, it } from "vitest";
import { planAppwriteDeployment, rollbackAppwritePlan } from "./plan.js";
import { customerEntity, orderEntity, shopModel } from "./test-fixtures.js";
import type { Model } from "@modelforge/schema-engine";

describe("planAppwriteDeployment", () => {
  it("plans create-collection for every entity when nothing is deployed yet", () => {
    const plan = planAppwriteDeployment(shopModel(), null);
    const createSteps = plan.steps.filter((s) => s.action === "create-collection");
    expect(createSteps.map((s) => s.target)).toEqual(["customer", "order"]);
  });

  it("plans add-attribute for a new attribute on an already-deployed collection", () => {
    const deployed: Model = {
      id: "shop",
      name: "Shop",
      adapter: "appwrite",
      entities: [customerEntity()],
      relationships: [],
      views: [],
      sequences: [],
      enums: [],
    };
    const current: Model = {
      ...deployed,
      entities: [
        {
          ...customerEntity(),
          attributes: [
            ...customerEntity().attributes,
            {
              id: "phone",
              name: "phone",
              logicalName: "Phone",
              type: "string",
              nullable: true,
              isPrimaryKey: false,
              isForeignKey: false,
              isUnique: false,
            },
          ],
        },
      ],
    };
    const plan = planAppwriteDeployment(current, deployed);
    expect(plan.steps).toEqual([
      expect.objectContaining({ action: "add-attribute", target: "customer.phone" }),
    ]);
  });

  it("plans drop-attribute (destructive) when an attribute is removed", () => {
    const deployed: Model = {
      id: "shop",
      name: "Shop",
      adapter: "appwrite",
      entities: [customerEntity()],
      relationships: [],
      views: [],
      sequences: [],
      enums: [],
    };
    const current: Model = {
      ...deployed,
      entities: [
        // The email_idx index only covers "email" — a real removeAttributeCascade would
        // drop the index along with the attribute, so this fixture does too, keeping the
        // scenario to strictly "an attribute was removed" rather than also exercising the
        // index-definition-changed path from a dangling attributeId.
        { ...customerEntity(), attributes: [customerEntity().attributes[0]!], indexes: [] },
      ],
    };
    const plan = planAppwriteDeployment(current, deployed);
    expect(plan.steps).toEqual([
      expect.objectContaining({
        action: "drop-attribute",
        target: "customer.email",
        destructive: true,
      }),
      expect.objectContaining({
        action: "drop-index",
        target: "customer.email_idx",
        destructive: true,
      }),
    ]);
  });

  it("plans nothing when current matches deployed", () => {
    const model = shopModel();
    const plan = planAppwriteDeployment(model, model);
    expect(plan.steps).toEqual([]);
  });

  it("plans drop-then-create-index when an existing index's definition changes", () => {
    const deployed: Model = {
      id: "shop",
      name: "Shop",
      adapter: "appwrite",
      entities: [customerEntity()],
      relationships: [],
      views: [],
      sequences: [],
      enums: [],
    };
    const current: Model = {
      ...deployed,
      entities: [
        {
          ...customerEntity(),
          // Same index id/name as the deployed snapshot, but no longer unique — the
          // UI's only way to "edit" an index is delete+recreate with the same name.
          indexes: [{ ...customerEntity().indexes[0]!, unique: false }],
        },
      ],
    };
    const plan = planAppwriteDeployment(current, deployed);
    const indexSteps = plan.steps.filter((s) => s.target === "customer.email_idx");
    expect(indexSteps.map((s) => s.action)).toEqual(["drop-index", "create-index"]);
    expect(indexSteps[0]?.warning).toMatch(/index's definition changed/i);
  });

  it("plans nothing for an index whose definition is unchanged", () => {
    const model = shopModel();
    const plan = planAppwriteDeployment(model, model);
    expect(plan.steps.some((s) => s.target === "customer.email_idx")).toBe(false);
  });

  it("plans create-relationship when a relationship is added between deployed collections", () => {
    const deployed: Model = {
      id: "shop",
      name: "Shop",
      adapter: "appwrite",
      entities: [customerEntity(), orderEntity()],
      relationships: [],
      views: [],
      sequences: [],
      enums: [],
    };
    const plan = planAppwriteDeployment(shopModel(), deployed);
    expect(plan.steps).toEqual([
      expect.objectContaining({ action: "create-relationship", target: "customer.orders" }),
    ]);
  });
});

describe("rollbackAppwritePlan", () => {
  it("inverts create-collection to a destructive drop-collection, in reverse order", () => {
    const plan = planAppwriteDeployment(shopModel(), null);
    const rollback = rollbackAppwritePlan(plan);
    expect(rollback.steps.map((s) => s.action)).toEqual(["drop-collection", "drop-collection"]);
    expect(rollback.steps[0]?.target).toBe("order");
    expect(rollback.steps.every((s) => s.destructive)).toBe(true);
  });

  it("flags a drop-attribute rollback as manual-restore-only rather than automatic", () => {
    const dropStep = {
      action: "drop-attribute" as const,
      target: "customer.email",
      destructive: true,
    };
    const rollback = rollbackAppwritePlan({ id: "p1", adapterKind: "appwrite", steps: [dropStep] });
    expect(rollback.steps[0]?.warning).toMatch(/cannot be automatically rolled back/i);
  });
});
