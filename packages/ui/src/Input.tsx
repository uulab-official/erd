import type { InputHTMLAttributes } from "react";

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

const INPUT_CLASS =
  "rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 " +
  "placeholder:text-slate-400 transition-colors focus:border-brand-500 focus:outline-none " +
  "focus:ring-1 focus:ring-brand-500 disabled:cursor-not-allowed disabled:bg-slate-50 " +
  "disabled:text-slate-400";

export function Input({ className, ...rest }: InputProps) {
  const classes = [INPUT_CLASS, className].filter(Boolean).join(" ");
  return <input className={classes} {...rest} />;
}
