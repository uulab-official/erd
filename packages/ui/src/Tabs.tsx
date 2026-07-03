import { Badge } from "./Badge.js";

export interface TabItem {
  id: string;
  label: string;
  // Omitted or 0 hides the badge — a tab with nothing to report shouldn't show a "0" pill.
  count?: number;
}

export interface TabsProps {
  items: TabItem[];
  activeId: string;
  onChange: (id: string) => void;
  className?: string;
}

// A single shared tab-bar implementation — BottomPanel and GovernancePanel each used to
// hand-roll their own font-semibold/text-neutral-500 button row; this is the one place
// that "which tab is active" gets styled from now on.
export function Tabs({ items, activeId, onChange, className }: TabsProps) {
  const classes = ["flex gap-1 border-b border-slate-200 px-2", className]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={classes}>
      {items.map((item) => {
        const active = item.id === activeId;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className={[
              "flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "border-brand-600 text-brand-700"
                : "border-transparent text-slate-500 hover:text-slate-800",
            ].join(" ")}
          >
            {item.label}
            {!!item.count && <Badge variant={active ? "brand" : "neutral"}>{item.count}</Badge>}
          </button>
        );
      })}
    </div>
  );
}
