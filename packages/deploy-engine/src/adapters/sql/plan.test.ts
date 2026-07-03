import { describe, expect, it } from "vitest";
import { createPostgresDialect } from "./dialect.js";
import { planSqlDeployment, rollbackSqlPlan } from "./plan.js";
import { customerEntity, shopModel } from "./test-fixtures.js";
import type { Model } from "@modelforge/schema-engine";

const dialect = createPostgresDialect();

describe("planSqlDeployment", () => {
  it("plans create-table (+ index/FK) for every table when nothing is deployed", () => {
    const plan = planSqlDeployment(shopModel(), null, dialect);
    expect(plan.steps.filter((s) => s.action === "create-table").map((s) => s.target)).toEqual([
      "customer",
      "purchase_order",
    ]);
    expect(plan.steps.some((s) => s.action === "create-index")).toBe(true);
    expect(plan.steps.some((s) => s.action === "create-relationship")).toBe(true);
  });

  it("plans add-attribute for a new column on an already-deployed table", () => {
    const deployed: Model = {
      id: "shop",
      name: "Shop",
      adapter: "postgresql",
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
              id: "customer_phone",
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
    const plan = planSqlDeployment(current, deployed, dialect);
    expect(plan.steps).toEqual([
      expect.objectContaining({ action: "add-attribute", target: "customer.phone" }),
    ]);
    expect(plan.steps[0]?.sql).toContain("ALTER TABLE");
  });

  it("plans drop-table (destructive) when a table is removed", () => {
    const deployed = shopModel();
    const current: Model = { ...deployed, entities: [customerEntity()], relationships: [] };
    const plan = planSqlDeployment(current, deployed, dialect);
    expect(plan.steps).toContainEqual(
      expect.objectContaining({
        action: "drop-table",
        target: "purchase_order",
        destructive: true,
      }),
    );
  });

  it("plans nothing when current matches deployed", () => {
    const model = shopModel();
    expect(planSqlDeployment(model, model, dialect).steps).toEqual([]);
  });

  it("warns when a column's auto-increment status changes, since the ALTER statement can't express it", () => {
    const integerPkEntity = {
      ...customerEntity(),
      attributes: customerEntity().attributes.map((a) =>
        a.isPrimaryKey ? { ...a, type: "integer" as const } : a,
      ),
    };
    const deployed: Model = {
      id: "shop",
      name: "Shop",
      adapter: "postgresql",
      // Composite PK on the deployed snapshot — no column is auto-increment yet.
      entities: [
        {
          ...integerPkEntity,
          attributes: integerPkEntity.attributes.map((a) => ({ ...a, isPrimaryKey: true })),
        },
      ],
      relationships: [],
      views: [],
      sequences: [],
      enums: [],
    };
    // Current model narrows back to a sole integer PK — that column should now be
    // auto-increment, which the plan can't express via ALTER COLUMN ... TYPE alone.
    const current: Model = { ...deployed, entities: [integerPkEntity] };
    const plan = planSqlDeployment(current, deployed, dialect);
    const idStep = plan.steps.find((s) => s.target === "customer.id");
    expect(idStep?.warning).toMatch(/auto-increment.*isn't captured/i);
  });

  it("does not add the auto-increment warning for an unrelated column change", () => {
    const deployed = shopModel();
    const current: Model = {
      ...deployed,
      entities: [
        {
          ...customerEntity(),
          attributes: customerEntity().attributes.map((a) => ({ ...a, nullable: true })),
        },
      ],
    };
    const plan = planSqlDeployment(current, deployed, dialect);
    const idStep = plan.steps.find((s) => s.target === "customer.id");
    expect(idStep?.warning).not.toMatch(/auto-increment/i);
  });
});

describe("rollbackSqlPlan", () => {
  it("inverts create-table to a destructive drop-table, in reverse order", () => {
    const plan = planSqlDeployment(shopModel(), null, dialect);
    const rollback = rollbackSqlPlan(plan);
    const dropTables = rollback.steps.filter((s) => s.action === "drop-table");
    expect(dropTables.every((s) => s.destructive)).toBe(true);
    expect(dropTables[0]?.target).toBe("purchase_order");
  });

  it("flags a drop-attribute rollback as manual-restore-only", () => {
    const dropStep = {
      action: "drop-attribute" as const,
      target: "customer.email",
      destructive: true,
    };
    const rollback = rollbackSqlPlan({ id: "p1", adapterKind: "postgresql", steps: [dropStep] });
    expect(rollback.steps[0]?.warning).toMatch(/cannot be automatically rolled back/i);
  });
});
