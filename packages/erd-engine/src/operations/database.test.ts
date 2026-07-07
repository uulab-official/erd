import { describe, expect, it } from "vitest";
import {
  createSequence,
  createView,
  deleteSequence,
  deleteView,
  updateSequence,
  updateView,
} from "./database.js";
import { applyInverse } from "./apply.js";
import { emptyModel } from "./test-fixtures.js";

const ORDER_SEQ = { id: "s1", name: "order_seq", start: 1, increment: 1 };
const ACTIVE_ORDERS_VIEW = { id: "v1", name: "active_orders", sql: "SELECT * FROM orders" };

describe("createSequence / deleteSequence", () => {
  it("creates a sequence and its inverse removes it", () => {
    const before = emptyModel();
    const { model, operation } = createSequence(before, { sequence: ORDER_SEQ }, "user-1");
    expect(model.sequences).toEqual([ORDER_SEQ]);
    expect(applyInverse(model, operation)).toEqual(before);
  });

  it("rejects creating a sequence with a duplicate id", () => {
    const before = createSequence(emptyModel(), { sequence: ORDER_SEQ }, "user-1").model;
    expect(() => createSequence(before, { sequence: ORDER_SEQ }, "user-1")).toThrow();
  });

  it("deletes a sequence and its inverse restores it", () => {
    const before = createSequence(emptyModel(), { sequence: ORDER_SEQ }, "user-1").model;
    const { model, operation } = deleteSequence(before, { sequenceId: "s1" }, "user-1");
    expect(model.sequences).toEqual([]);
    expect(applyInverse(model, operation)).toEqual(before);
  });

  it("throws deleting a sequence that doesn't exist", () => {
    expect(() => deleteSequence(emptyModel(), { sequenceId: "missing" }, "user-1")).toThrow();
  });
});

describe("updateSequence", () => {
  it("updates only the given fields and its inverse restores them", () => {
    const before = createSequence(emptyModel(), { sequence: ORDER_SEQ }, "user-1").model;
    const { model, operation } = updateSequence(
      before,
      { sequenceId: "s1", changes: { increment: 5 } },
      "user-1",
    );
    expect(model.sequences[0]).toMatchObject({ increment: 5, name: "order_seq" });
    expect(applyInverse(model, operation)).toEqual(before);
  });
});

describe("createView / deleteView", () => {
  it("creates a view and its inverse removes it", () => {
    const before = emptyModel();
    const { model, operation } = createView(before, { view: ACTIVE_ORDERS_VIEW }, "user-1");
    expect(model.views).toEqual([ACTIVE_ORDERS_VIEW]);
    expect(applyInverse(model, operation)).toEqual(before);
  });

  it("rejects creating a view with a duplicate id", () => {
    const before = createView(emptyModel(), { view: ACTIVE_ORDERS_VIEW }, "user-1").model;
    expect(() => createView(before, { view: ACTIVE_ORDERS_VIEW }, "user-1")).toThrow();
  });

  it("deletes a view and its inverse restores it", () => {
    const before = createView(emptyModel(), { view: ACTIVE_ORDERS_VIEW }, "user-1").model;
    const { model, operation } = deleteView(before, { viewId: "v1" }, "user-1");
    expect(model.views).toEqual([]);
    expect(applyInverse(model, operation)).toEqual(before);
  });
});

describe("updateView", () => {
  it("updates only the given fields and its inverse restores them", () => {
    const before = createView(emptyModel(), { view: ACTIVE_ORDERS_VIEW }, "user-1").model;
    const { model, operation } = updateView(
      before,
      { viewId: "v1", changes: { sql: "SELECT * FROM orders WHERE status = 'active'" } },
      "user-1",
    );
    expect(model.views[0]).toMatchObject({
      sql: "SELECT * FROM orders WHERE status = 'active'",
      name: "active_orders",
    });
    expect(applyInverse(model, operation)).toEqual(before);
  });
});
