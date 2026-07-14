import { describe, expect, it } from "vitest";
import { createPostgresDialect } from "./dialect.js";
import { createMySqlDialect } from "./mysql.js";
import { planSqlDeployment, rollbackSqlPlan } from "./plan.js";
import { customerEntity, orderEntity, placesRelationship, shopModel } from "./test-fixtures.js";
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

  it("warns when an enum column's allowed values change, since the ALTER statement can't express it", () => {
    const entityWithEnum = () => ({
      ...customerEntity(),
      attributes: [
        ...customerEntity().attributes,
        {
          id: "customer_status",
          name: "status",
          logicalName: "Status",
          type: "enum" as const,
          enumId: "e1",
          nullable: false,
          isPrimaryKey: false,
          isForeignKey: false,
          isUnique: false,
        },
      ],
    });
    const deployed: Model = {
      id: "shop",
      name: "Shop",
      adapter: "postgresql",
      entities: [entityWithEnum()],
      relationships: [],
      views: [],
      sequences: [],
      enums: [{ id: "e1", name: "Status", values: ["pending"] }],
    };
    const current: Model = {
      ...deployed,
      enums: [{ id: "e1", name: "Status", values: ["pending", "shipped"] }],
    };
    const plan = planSqlDeployment(current, deployed, dialect);
    const statusStep = plan.steps.find((s) => s.target === "customer.status");
    expect(statusStep?.warning).toMatch(/enum values.*isn't captured/i);
  });

  it("warns when a column's comment changes, since the ALTER statement can't express it", () => {
    const deployed = shopModel();
    const current: Model = {
      ...deployed,
      entities: [
        {
          ...customerEntity(),
          attributes: customerEntity().attributes.map((a) =>
            a.name === "email" ? { ...a, comment: "primary contact address" } : a,
          ),
        },
        deployed.entities[1]!,
      ],
    };
    const plan = planSqlDeployment(current, deployed, dialect);
    const emailStep = plan.steps.find((s) => s.target === "customer.email");
    expect(emailStep?.warning).toMatch(/comment.*isn't captured/i);
  });

  it("does not add the comment warning for an unrelated column change", () => {
    const deployed = shopModel();
    const current: Model = {
      ...deployed,
      entities: [
        {
          ...customerEntity(),
          attributes: customerEntity().attributes.map((a) => ({ ...a, nullable: true })),
        },
        deployed.entities[1]!,
      ],
    };
    const plan = planSqlDeployment(current, deployed, dialect);
    const emailStep = plan.steps.find((s) => s.target === "customer.email");
    expect(emailStep?.warning).not.toMatch(/comment/i);
  });

  it("warns when a non-PK column's UNIQUE constraint is toggled, since the ALTER statement can't express it", () => {
    const deployed: Model = {
      id: "shop",
      name: "Shop",
      adapter: "postgresql",
      entities: [
        {
          ...customerEntity(),
          attributes: customerEntity().attributes.map((a) =>
            a.name === "email" ? { ...a, isUnique: false } : a,
          ),
        },
        orderEntity(),
      ],
      relationships: [],
      views: [],
      sequences: [],
      enums: [],
    };
    const current: Model = { ...deployed, entities: [customerEntity(), orderEntity()] };
    const plan = planSqlDeployment(current, deployed, dialect);
    const emailStep = plan.steps.find((s) => s.target === "customer.email");
    expect(emailStep?.warning).toMatch(/UNIQUE constraint.*isn't captured/i);
  });

  it("plans a drop-then-recreate foreign key when an existing FK's definition changes (e.g. onDelete)", () => {
    const deployed = shopModel();
    const current: Model = {
      ...deployed,
      relationships: [{ ...placesRelationship(), onDelete: "set-null" }],
    };
    const plan = planSqlDeployment(current, deployed, dialect);
    const step = plan.steps.find((s) => s.target === "purchase_order.fk_purchase_order_places");
    expect(step?.action).toBe("create-relationship");
    expect(step?.sql).toContain("DROP CONSTRAINT");
    expect(step?.sql).toContain("ADD CONSTRAINT");
    expect(step?.warning).toMatch(/foreign key's definition changed/i);
  });

  it("plans nothing for a foreign key whose definition is unchanged", () => {
    const model = shopModel();
    const plan = planSqlDeployment(model, model, dialect);
    expect(plan.steps.some((s) => s.target === "purchase_order.fk_purchase_order_places")).toBe(
      false,
    );
  });

  it("plans create-sequence/create-view when a Sequence/View is added", () => {
    const model = shopModel();
    model.sequences = [{ id: "s1", name: "order_seq", start: 1, increment: 1 }];
    model.views = [{ id: "v1", name: "active_orders", sql: "SELECT * FROM purchase_order" }];
    const plan = planSqlDeployment(model, null, dialect);
    expect(plan.steps).toContainEqual(
      expect.objectContaining({ action: "create-sequence", target: "order_seq" }),
    );
    expect(plan.steps).toContainEqual(
      expect.objectContaining({ action: "create-view", target: "active_orders" }),
    );
  });

  it("plans drop-sequence/drop-view when a Sequence/View is removed", () => {
    const deployed = shopModel();
    deployed.sequences = [{ id: "s1", name: "order_seq", start: 1, increment: 1 }];
    deployed.views = [{ id: "v1", name: "active_orders", sql: "SELECT * FROM purchase_order" }];
    const current = { ...deployed, sequences: [], views: [] };
    const plan = planSqlDeployment(current, deployed, dialect);
    expect(plan.steps).toContainEqual(
      expect.objectContaining({ action: "drop-sequence", target: "order_seq", destructive: true }),
    );
    expect(plan.steps).toContainEqual(
      expect.objectContaining({ action: "drop-view", target: "active_orders", destructive: true }),
    );
  });

  it("plans alter-sequence when an existing sequence's start/increment changes", () => {
    const deployed = shopModel();
    deployed.sequences = [{ id: "s1", name: "order_seq", start: 1, increment: 1 }];
    const current = {
      ...deployed,
      sequences: [{ id: "s1", name: "order_seq", start: 100, increment: 5 }],
    };
    const plan = planSqlDeployment(current, deployed, dialect);
    const step = plan.steps.find((s) => s.target === "order_seq");
    expect(step?.action).toBe("alter-sequence");
    expect(step?.sql).toContain("ALTER SEQUENCE");
    expect(step?.sql).toContain("INCREMENT BY 5");
    expect(step?.sql).toContain("RESTART WITH 100");
  });

  it("plans nothing for a sequence whose start/increment is unchanged", () => {
    const model = shopModel();
    model.sequences = [{ id: "s1", name: "order_seq", start: 1, increment: 1 }];
    const plan = planSqlDeployment(model, model, dialect);
    expect(plan.steps.some((s) => s.target === "order_seq")).toBe(false);
  });

  it("plans a drop-then-create-view when a View's query changes", () => {
    const deployed = shopModel();
    deployed.views = [{ id: "v1", name: "active_orders", sql: "SELECT * FROM purchase_order" }];
    const current = {
      ...deployed,
      views: [{ id: "v1", name: "active_orders", sql: "SELECT * FROM purchase_order WHERE 1=1" }],
    };
    const plan = planSqlDeployment(current, deployed, dialect);
    const step = plan.steps.find((s) => s.target === "active_orders");
    expect(step?.action).toBe("create-view");
    expect(step?.sql).toContain("DROP VIEW");
    expect(step?.sql).toContain("CREATE VIEW");
  });

  it("plans a drop-then-create-index when an existing index's definition changes", () => {
    const deployed = shopModel();
    const current: Model = {
      ...deployed,
      entities: [
        {
          ...customerEntity(),
          // Same index id/name as the deployed snapshot, but no longer unique — the
          // UI's only way to "edit" an index is delete+recreate with the same name, so
          // this mirrors that path exactly.
          indexes: [{ ...customerEntity().indexes[0]!, unique: false }],
        },
        deployed.entities[1]!,
      ],
    };
    const plan = planSqlDeployment(current, deployed, dialect);
    const step = plan.steps.find((s) => s.target === "customer.email_idx");
    expect(step?.action).toBe("create-index");
    expect(step?.sql).toContain("DROP INDEX");
    expect(step?.sql).toContain("CREATE");
    expect(step?.warning).toMatch(/index's definition changed/i);
  });

  it("plans nothing for an index whose definition is unchanged", () => {
    const model = shopModel();
    const plan = planSqlDeployment(model, model, dialect);
    expect(plan.steps.some((s) => s.target === "customer.email_idx")).toBe(false);
  });

  it("warns instead of guessing at sequence DDL for a dialect with no native sequence support", () => {
    const mysqlDialect = createMySqlDialect();
    const model = shopModel();
    model.sequences = [{ id: "s1", name: "order_seq", start: 1, increment: 1 }];
    const plan = planSqlDeployment(model, null, mysqlDialect);
    const step = plan.steps.find((s) => s.action === "create-sequence");
    expect(step?.warning).toMatch(/no native sequence object/i);
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
