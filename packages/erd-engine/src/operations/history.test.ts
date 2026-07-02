import { describe, expect, it } from "vitest";
import { createEntity, renameEntity } from "./entity.js";
import { deleteEntityCascade } from "./transaction.js";
import { OperationHistory } from "./history.js";
import { describeHistoryEntry } from "./describe.js";
import { customerEntity, emptyModel } from "./test-fixtures.js";

describe("OperationHistory", () => {
  it("undoes and redoes a single operation", () => {
    const history = new OperationHistory();
    const empty = emptyModel();
    const created = createEntity(empty, customerEntity(), "user-1");
    history.push(created.operation);

    expect(history.undo(created.model)).toEqual(empty);

    const renamed = renameEntity(
      created.model,
      { entityId: "customer", logicalName: "Client" },
      "user-1",
    );
    history.push(renamed.operation);
    expect(history.canRedo()).toBe(false);
  });

  it("undo followed by redo returns to the same state", () => {
    const history = new OperationHistory();
    const empty = emptyModel();
    const created = createEntity(empty, customerEntity(), "user-1");
    history.push(created.operation);

    const undone = history.undo(created.model);
    expect(undone).toEqual(empty);
    expect(history.canRedo()).toBe(true);

    const redone = history.redo(undone);
    expect(redone).toEqual(created.model);
    expect(history.canRedo()).toBe(false);
  });

  it("pushing a new operation clears the redo stack", () => {
    const history = new OperationHistory();
    const empty = emptyModel();
    const created = createEntity(empty, customerEntity(), "user-1");
    history.push(created.operation);
    history.undo(created.model);
    expect(history.canRedo()).toBe(true);

    const other = createEntity(empty, { ...customerEntity(), id: "product" }, "user-1");
    history.push(other.operation);
    expect(history.canRedo()).toBe(false);
  });

  it("undoes a compound Transaction atomically", () => {
    const history = new OperationHistory();
    const created = createEntity(emptyModel(), customerEntity(), "user-1");
    const { model, transaction } = deleteEntityCascade(created.model, "customer", "user-1");
    history.push(transaction);

    expect(history.undo(model)).toEqual(created.model);
    expect(history.redo(created.model)).toEqual(model);
  });

  it("no-ops when there is nothing to undo/redo", () => {
    const history = new OperationHistory();
    const model = emptyModel();
    expect(history.undo(model)).toBe(model);
    expect(history.redo(model)).toBe(model);
  });

  it("entries() reflects push/undo/redo in chronological order", () => {
    const history = new OperationHistory();
    const empty = emptyModel();
    const created = createEntity(empty, customerEntity(), "user-1");
    history.push(created.operation);
    const renamed = renameEntity(
      created.model,
      { entityId: "customer", logicalName: "Client" },
      "user-1",
    );
    history.push(renamed.operation);

    expect(history.entries().map(describeHistoryEntry)).toEqual(["Create entity", "Rename entity"]);

    history.undo(renamed.model);
    expect(history.entries().map(describeHistoryEntry)).toEqual(["Create entity"]);
  });

  it("jumpToIndex rewinds to just after the given entry", () => {
    const history = new OperationHistory();
    const empty = emptyModel();
    const created = createEntity(empty, customerEntity(), "user-1");
    history.push(created.operation);
    const renamed = renameEntity(
      created.model,
      { entityId: "customer", logicalName: "Client" },
      "user-1",
    );
    history.push(renamed.operation);
    const moved = renameEntity(
      renamed.model,
      { entityId: "customer", logicalName: "Buyer" },
      "user-1",
    );
    history.push(moved.operation);

    const rewound = history.jumpToIndex(moved.model, 0);
    expect(rewound).toEqual(created.model);
    expect(history.entries()).toHaveLength(1);
    expect(history.canRedo()).toBe(true);
  });

  it("jumpToIndex is a no-op for an out-of-range index", () => {
    const history = new OperationHistory();
    const empty = emptyModel();
    const created = createEntity(empty, customerEntity(), "user-1");
    history.push(created.operation);

    expect(history.jumpToIndex(created.model, 5)).toBe(created.model);
    expect(history.jumpToIndex(created.model, -1)).toBe(created.model);
    expect(history.entries()).toHaveLength(1);
  });
});
