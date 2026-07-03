import { describe, expect, it } from "vitest";
import { Select } from "./Select.js";

describe("Select", () => {
  it("merges a custom className with the base select styling", () => {
    const element = Select({ className: "w-20" });
    expect(element.props.className).toContain("rounded-md");
    expect(element.props.className).toContain("w-20");
  });
});
