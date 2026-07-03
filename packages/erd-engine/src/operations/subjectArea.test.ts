import { describe, expect, it } from "vitest";
import { applyInverse } from "./apply.js";
import { createEntity } from "./entity.js";
import {
  assignEntityToSubjectArea,
  createSubjectArea,
  deleteSubjectArea,
  unassignEntityFromSubjectArea,
  updateSubjectArea,
} from "./subjectArea.js";
import { customerEntity, emptyModel, orderEntity } from "./test-fixtures.js";

function twoEntityModel() {
  let model = createEntity(emptyModel(), customerEntity(), "user-1").model;
  model = createEntity(model, orderEntity(), "user-1").model;
  return model;
}

const SALES = { id: "sa1", name: "Sales", entityIds: [] as string[] };

describe("createSubjectArea / deleteSubjectArea", () => {
  it("creates a subject area and its inverse removes it", () => {
    const before = twoEntityModel();
    const { model, operation } = createSubjectArea(before, { subjectArea: SALES }, "user-1");
    expect(model.subjectAreas).toEqual([SALES]);
    expect(applyInverse(model, operation)).toEqual(before);
  });

  it("throws when creating a duplicate id", () => {
    const before = createSubjectArea(twoEntityModel(), { subjectArea: SALES }, "user-1").model;
    expect(() => createSubjectArea(before, { subjectArea: SALES }, "user-1")).toThrow();
  });

  it("deleteSubjectArea throws when entities are still assigned", () => {
    const withArea = createSubjectArea(twoEntityModel(), { subjectArea: SALES }, "user-1").model;
    const withAssignment = assignEntityToSubjectArea(
      withArea,
      { entityId: "customer", subjectAreaId: "sa1" },
      "user-1",
    ).model;
    expect(() => deleteSubjectArea(withAssignment, { subjectAreaId: "sa1" }, "user-1")).toThrow();
  });

  it("deleteSubjectArea succeeds and its inverse restores it when empty", () => {
    const before = createSubjectArea(twoEntityModel(), { subjectArea: SALES }, "user-1").model;
    const { model, operation } = deleteSubjectArea(before, { subjectAreaId: "sa1" }, "user-1");
    expect(model.subjectAreas).toEqual([]);
    expect(applyInverse(model, operation)).toEqual(before);
  });
});

describe("updateSubjectArea", () => {
  it("updates name/color and its inverse restores them", () => {
    const before = createSubjectArea(twoEntityModel(), { subjectArea: SALES }, "user-1").model;
    const { model, operation } = updateSubjectArea(
      before,
      { subjectAreaId: "sa1", changes: { name: "Sales & CRM", color: "#f00" } },
      "user-1",
    );
    expect(model.subjectAreas?.[0]).toMatchObject({ name: "Sales & CRM", color: "#f00" });
    expect(applyInverse(model, operation)).toEqual(before);
  });
});

describe("assignEntityToSubjectArea / unassignEntityFromSubjectArea", () => {
  it("assigns an entity, keeping entityIds and subjectAreaId in sync, and its inverse restores both", () => {
    const before = createSubjectArea(twoEntityModel(), { subjectArea: SALES }, "user-1").model;
    const { model, operation } = assignEntityToSubjectArea(
      before,
      { entityId: "customer", subjectAreaId: "sa1" },
      "user-1",
    );
    expect(model.entities.find((e) => e.id === "customer")?.subjectAreaId).toBe("sa1");
    expect(model.subjectAreas?.[0]?.entityIds).toEqual(["customer"]);
    expect(applyInverse(model, operation)).toEqual(before);
  });

  it("moving an entity to a new subject area removes it from the old one", () => {
    const marketing = { id: "sa2", name: "Marketing", entityIds: [] as string[] };
    let model = createSubjectArea(twoEntityModel(), { subjectArea: SALES }, "user-1").model;
    model = createSubjectArea(model, { subjectArea: marketing }, "user-1").model;
    model = assignEntityToSubjectArea(
      model,
      { entityId: "customer", subjectAreaId: "sa1" },
      "user-1",
    ).model;
    const { model: reassigned } = assignEntityToSubjectArea(
      model,
      { entityId: "customer", subjectAreaId: "sa2" },
      "user-1",
    );
    expect(reassigned.subjectAreas?.find((s) => s.id === "sa1")?.entityIds).toEqual([]);
    expect(reassigned.subjectAreas?.find((s) => s.id === "sa2")?.entityIds).toEqual(["customer"]);
    expect(reassigned.entities.find((e) => e.id === "customer")?.subjectAreaId).toBe("sa2");
  });

  it("unassignEntityFromSubjectArea clears membership and its inverse restores it", () => {
    const withArea = createSubjectArea(twoEntityModel(), { subjectArea: SALES }, "user-1").model;
    const assigned = assignEntityToSubjectArea(
      withArea,
      { entityId: "customer", subjectAreaId: "sa1" },
      "user-1",
    ).model;
    const { model, operation } = unassignEntityFromSubjectArea(
      assigned,
      { entityId: "customer" },
      "user-1",
    );
    expect(model.entities.find((e) => e.id === "customer")?.subjectAreaId).toBeUndefined();
    expect(model.subjectAreas?.[0]?.entityIds).toEqual([]);
    expect(applyInverse(model, operation)).toEqual(assigned);
  });

  it("throws for an unknown entity or subject area", () => {
    const before = createSubjectArea(twoEntityModel(), { subjectArea: SALES }, "user-1").model;
    expect(() =>
      assignEntityToSubjectArea(before, { entityId: "missing", subjectAreaId: "sa1" }, "user-1"),
    ).toThrow();
    expect(() =>
      assignEntityToSubjectArea(
        before,
        { entityId: "customer", subjectAreaId: "missing" },
        "user-1",
      ),
    ).toThrow();
  });
});
