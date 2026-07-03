import { describe, expect, it } from "vitest";
import { Input } from "./Input.js";

describe("Input", () => {
  it("merges a custom className with the base input styling", () => {
    const element = Input({ className: "flex-1" });
    expect(element.props.className).toContain("rounded-md");
    expect(element.props.className).toContain("flex-1");
  });
});
