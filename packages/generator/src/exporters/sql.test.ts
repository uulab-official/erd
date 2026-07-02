import { describe, expect, it } from "vitest";
import { mysqlExporter, sqlExporter, sqliteExporter } from "./sql.js";
import type { Model } from "@modelforge/schema-engine";

function shopModel(): Model {
  return {
    id: "m1",
    name: "Shop",
    adapter: "postgresql",
    relationships: [
      {
        id: "r1",
        sourceEntityId: "customer",
        targetEntityId: "order",
        cardinality: "one-to-many",
        kind: "non-identifying",
        optionality: "mandatory",
        sourceAttributeIds: ["id"],
        targetAttributeIds: ["customer_id"],
      },
    ],
    views: [],
    sequences: [],
    enums: [],
    entities: [
      {
        id: "customer",
        logicalName: "Customer",
        physicalName: "customer",
        tags: [],
        attributes: [
          {
            id: "id",
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
        id: "order",
        logicalName: "Order",
        physicalName: "order",
        tags: [],
        attributes: [
          {
            id: "customer_id",
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
    ],
  };
}

describe("sqlExporter", () => {
  it("renders CREATE TABLE statements for every entity", async () => {
    const sql = (await sqlExporter.export(shopModel())) as string;
    expect(sql).toContain('CREATE TABLE "customer"');
    expect(sql).toContain('CREATE TABLE "order"');
    expect(sql).toContain("FOREIGN KEY");
  });

  it("declares its target format", () => {
    expect(sqlExporter.targetFormat).toBe("sql");
  });
});

describe("mysqlExporter", () => {
  it("renders MySQL-flavored DDL (backtick identifiers, char(36) for uuid)", async () => {
    const sql = (await mysqlExporter.export(shopModel())) as string;
    expect(sql).toContain("CREATE TABLE `customer`");
    expect(sql).toContain("char(36)");
  });
});

describe("sqliteExporter", () => {
  it("inlines foreign keys instead of a separate ALTER TABLE", async () => {
    const sql = (await sqliteExporter.export(shopModel())) as string;
    expect(sql).toContain("FOREIGN KEY");
    expect(sql).not.toContain("ALTER TABLE");
  });
});
