import { describe, expect, it } from "vitest";
import { Card } from "./Card.js";

describe("Card", () => {
  it("merges a custom className with the base card styling", () => {
    const element = Card({ className: "p-4" });
    expect(element.props.className).toContain("rounded-lg");
    expect(element.props.className).toContain("p-4");
  });
});
