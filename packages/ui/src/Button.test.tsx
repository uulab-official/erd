import { describe, expect, it } from "vitest";
import { Button } from "./Button.js";

describe("Button", () => {
  it("applies the variant class", () => {
    const element = Button({ variant: "danger" });
    expect(element.props.className).toContain("mf-button--danger");
  });
});
