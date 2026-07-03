import type { ElementType, HTMLAttributes } from "react";

export interface CardProps extends HTMLAttributes<HTMLElement> {
  // Cards are as often list rows (`as="li"`) as standalone containers (`as="div"`, the
  // default) — a fixed `<div>` would force callers to nest an extra nameless wrapper.
  as?: ElementType;
}

const CARD_CLASS = "rounded-lg border border-slate-200 bg-white";

export function Card({ as: Component = "div", className, ...rest }: CardProps) {
  const classes = [CARD_CLASS, className].filter(Boolean).join(" ");
  return <Component className={classes} {...rest} />;
}
