import { describe, expect, it, vi } from "vitest";
import { Tabs } from "./Tabs.js";

const ITEMS = [
  { id: "a", label: "Validation", count: 2 },
  { id: "b", label: "Diff" },
];

describe("Tabs", () => {
  it("renders one button per item, highlighting the active one", () => {
    const element = Tabs({ items: ITEMS, activeId: "a", onChange: vi.fn() });
    const buttons = element.props.children as unknown[];
    expect(buttons).toHaveLength(2);

    const active = buttons[0] as { props: { className: string } };
    const inactive = buttons[1] as { props: { className: string } };
    expect(active.props.className).toContain("border-brand-600");
    expect(inactive.props.className).toContain("border-transparent");
  });

  it("only shows a count badge when count is truthy", () => {
    const element = Tabs({ items: ITEMS, activeId: "a", onChange: vi.fn() });
    const buttons = element.props.children as { props: { children: unknown[] } }[];
    const [withCount, withoutCount] = buttons;
    expect(withCount!.props.children[1]).toBeTruthy();
    expect(withoutCount!.props.children[1]).toBeFalsy();
  });

  it("calls onChange with the clicked tab's id", () => {
    const onChange = vi.fn();
    const element = Tabs({ items: ITEMS, activeId: "a", onChange });
    const buttons = element.props.children as { props: { onClick: () => void } }[];
    buttons[1]!.props.onClick();
    expect(onChange).toHaveBeenCalledWith("b");
  });
});
