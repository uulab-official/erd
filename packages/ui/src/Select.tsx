import type { SelectHTMLAttributes } from "react";

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

const SELECT_CLASS =
  "rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 " +
  "transition-colors focus:border-brand-500 focus:outline-none focus:ring-1 " +
  "focus:ring-brand-500 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400";

export function Select({ className, ...rest }: SelectProps) {
  const classes = [SELECT_CLASS, className].filter(Boolean).join(" ");
  return <select className={classes} {...rest} />;
}
