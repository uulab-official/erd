import { describe, expect, it } from "vitest";
import { applyInverse } from "./apply.js";
import { createMemo, deleteMemo, moveMemo, updateMemoText } from "./memo.js";
import { emptyModel } from "./test-fixtures.js";

const NOTE = { id: "memo1", text: "Rewritten in v2", x: 100, y: 50 };

describe("createMemo / deleteMemo", () => {
  it("creates a memo and its inverse removes it", () => {
    const before = emptyModel();
    const { model, operation } = createMemo(before, { memo: NOTE }, "user-1");
    expect(model.memos).toEqual([NOTE]);
    expect(applyInverse(model, operation)).toEqual(before);
  });

  it("throws when creating a duplicate id", () => {
    const before = createMemo(emptyModel(), { memo: NOTE }, "user-1").model;
    expect(() => createMemo(before, { memo: NOTE }, "user-1")).toThrow();
  });

  it("deleteMemo's inverse restores it fully (text and position)", () => {
    const created = createMemo(emptyModel(), { memo: NOTE }, "user-1").model;
    const { model, operation } = deleteMemo(created, { memoId: "memo1" }, "user-1");
    expect(model.memos).toEqual([]);
    expect(applyInverse(model, operation)).toEqual(created);
  });

  it("throws when deleting an unknown memo", () => {
    expect(() => deleteMemo(emptyModel(), { memoId: "missing" }, "user-1")).toThrow();
  });
});

describe("updateMemoText", () => {
  it("updates the text and its inverse restores the original", () => {
    const created = createMemo(emptyModel(), { memo: NOTE }, "user-1").model;
    const { model, operation } = updateMemoText(
      created,
      { memoId: "memo1", text: "Actually stays as-is" },
      "user-1",
    );
    expect(model.memos?.[0]?.text).toBe("Actually stays as-is");
    expect(applyInverse(model, operation)).toEqual(created);
  });
});

describe("moveMemo", () => {
  it("updates position and its inverse restores the original", () => {
    const created = createMemo(emptyModel(), { memo: NOTE }, "user-1").model;
    const { model, operation } = moveMemo(created, { memoId: "memo1", x: 300, y: 400 }, "user-1");
    expect(model.memos?.[0]).toMatchObject({ x: 300, y: 400 });
    expect(applyInverse(model, operation)).toEqual(created);
  });

  it("throws when moving an unknown memo", () => {
    expect(() => moveMemo(emptyModel(), { memoId: "missing", x: 0, y: 0 }, "user-1")).toThrow();
  });
});
