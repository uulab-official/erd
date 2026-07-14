import { describe, expect, it } from "vitest";
import { parseDbml } from "./dbml.js";

const SAMPLE = `
// dbdiagram.io sample
Project shop { database_type: 'PostgreSQL' }

Enum order_status {
  pending
  shipped
  delivered
}

Table users as U {
  id uuid [pk]
  email varchar(320) [not null, unique, note: 'login id']
  display_name varchar(100) [default: 'anonymous']
  age int
  created_at timestamp [default: \`now()\`]
}

Table orders {
  id uuid [pk]
  user_id uuid [ref: > users.id, not null]
  status order_status [default: 'pending']
  total decimal(10,2)

  indexes {
    (user_id, status) [unique, name: 'idx_orders_user_status']
    status
  }
}

Table profiles {
  id uuid [pk]
  user_id uuid [not null]
}

Ref: profiles.user_id - users.id
`;

describe("parseDbml", () => {
  const model = parseDbml(SAMPLE);

  it("parses tables with aliases as logical names", () => {
    expect(model.entities.map((e) => e.id)).toEqual(["users", "orders", "profiles"]);
    expect(model.entities[0]).toMatchObject({ logicalName: "U", physicalName: "users" });
  });

  it("maps column types, lengths and scales", () => {
    const users = model.entities[0]!;
    expect(users.attributes.find((a) => a.name === "email")).toMatchObject({
      type: "string",
      length: 320,
      nullable: false,
      isUnique: true,
      comment: "login id",
    });
    expect(users.attributes.find((a) => a.name === "age")).toMatchObject({ type: "integer" });
    const total = model.entities[1]!.attributes.find((a) => a.name === "total");
    expect(total).toMatchObject({ type: "float", length: 10, scale: 2 });
  });

  it("parses pk / defaults, including function defaults", () => {
    const users = model.entities[0]!;
    expect(users.attributes.find((a) => a.name === "id")).toMatchObject({
      isPrimaryKey: true,
      nullable: false,
      isUnique: true,
    });
    expect(users.attributes.find((a) => a.name === "display_name")?.default).toBe("anonymous");
    expect(users.attributes.find((a) => a.name === "created_at")?.default).toBe("now()");
  });

  it("types enum columns against declared enums and collects enum values", () => {
    expect(model.enums).toEqual([
      { id: "order_status", name: "order_status", values: ["pending", "shipped", "delivered"] },
    ]);
    expect(model.entities[1]!.attributes.find((a) => a.name === "status")?.type).toBe("enum");
  });

  it("links an enum column to its EnumType via enumId, not just the bare type", () => {
    expect(model.entities[1]!.attributes.find((a) => a.name === "status")?.enumId).toBe(
      "order_status",
    );
  });

  it("builds one-to-many relationships from inline refs, marking the FK", () => {
    const rel = model.relationships.find((r) => r.targetEntityId === "orders");
    expect(rel).toMatchObject({
      sourceEntityId: "users",
      targetEntityId: "orders",
      cardinality: "one-to-many",
      optionality: "mandatory",
      sourceAttributeIds: ["users.id"],
      targetAttributeIds: ["orders.user_id"],
    });
    expect(model.entities[1]!.attributes.find((a) => a.name === "user_id")?.isForeignKey).toBe(
      true,
    );
  });

  it("builds one-to-one relationships from standalone '-' refs", () => {
    const rel = model.relationships.find((r) => r.targetEntityId === "profiles");
    expect(rel).toMatchObject({ cardinality: "one-to-one", sourceEntityId: "users" });
    expect(model.entities[2]!.attributes.find((a) => a.name === "user_id")?.isUnique).toBe(true);
  });

  it("parses indexes blocks with composite columns, unique and custom names", () => {
    const orders = model.entities[1]!;
    expect(orders.indexes).toEqual([
      {
        id: "orders.idx.user_id_status",
        name: "idx_orders_user_status",
        attributeIds: ["orders.user_id", "orders.status"],
        unique: true,
      },
      {
        id: "orders.idx.status",
        name: "idx_orders_status",
        attributeIds: ["orders.status"],
        unique: false,
      },
    ]);
  });

  it("parses an index's [type: ...] setting", () => {
    const model2 = parseDbml(`
Table widgets {
  id uuid [pk]
  sku varchar(50)

  indexes {
    sku [type: hash, name: 'idx_widgets_sku']
  }
}
`);
    expect(model2.entities[0]!.indexes).toEqual([
      {
        id: "widgets.idx.sku",
        name: "idx_widgets_sku",
        attributeIds: ["widgets.sku"],
        unique: false,
        type: "hash",
      },
    ]);
  });

  it("ignores an unrecognized index [type: ...] value rather than guessing", () => {
    const model2 = parseDbml(`
Table widgets {
  id uuid [pk]
  sku varchar(50)

  indexes {
    sku [type: spgist]
  }
}
`);
    expect(model2.entities[0]!.indexes[0]).not.toHaveProperty("type");
  });

  it("reverses '<' refs so the relationship still points one-side to many-side", () => {
    const model2 = parseDbml(`
Table a {
  id uuid [pk]
}
Table b {
  id uuid [pk]
  a_id uuid
}
Ref: a.id < b.a_id
`);
    expect(model2.relationships[0]).toMatchObject({
      sourceEntityId: "a",
      targetEntityId: "b",
      cardinality: "one-to-many",
    });
  });

  it("drops refs to unknown tables or columns instead of failing", () => {
    const model2 = parseDbml(`
Table a { id uuid [pk] }
Ref: a.id < ghosts.a_id
Ref: a.id < a.missing_column
`);
    expect(model2.relationships).toEqual([]);
  });

  it("ignores comments, quoted identifiers, and unknown types fall back to string", () => {
    const model2 = parseDbml(`
Table "user table" {
  id uuid [pk] // trailing comment
  blob_col mystery_type
  /* block
     comment */
  note varchar
}
`);
    const entity = model2.entities[0]!;
    expect(entity.physicalName).toBe("user table");
    expect(entity.attributes.map((a) => a.name)).toEqual(["id", "blob_col", "note"]);
    expect(entity.attributes[1]?.type).toBe("string");
  });
});
