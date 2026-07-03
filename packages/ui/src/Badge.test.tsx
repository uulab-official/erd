import { describe, expect, it } from "vitest";
import { Badge } from "./Badge.js";

describe("Badge", () => {
  it("applies the variant class", () => {
    const element = Badge({ variant: "danger", children: "3" });
    expect(element.props.className).toContain("bg-red-100");
  });

  it("defaults to the neutral variant", () => {
    const element = Badge({ children: "3" });
    expect(element.props.className).toContain("bg-slate-100");
  });
});
