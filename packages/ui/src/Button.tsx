import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const BASE_CLASS =
  "inline-flex items-center justify-center gap-1.5 rounded-md font-medium " +
  "transition-colors disabled:pointer-events-none disabled:opacity-50 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1";

// `mf-button`/`mf-button--<variant>` are kept as stable semantic hooks (for tests and any
// future e2e selectors) — the actual look comes entirely from the Tailwind utilities below,
// so this component never depends on some other package remembering to define matching CSS.
const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary:
    "mf-button--primary bg-brand-600 text-white shadow-sm hover:bg-brand-700 " +
    "focus-visible:ring-brand-500",
  secondary:
    "mf-button--secondary border border-slate-300 bg-white text-slate-700 shadow-sm " +
    "hover:bg-slate-50 focus-visible:ring-brand-500",
  ghost:
    "mf-button--ghost text-slate-600 hover:bg-slate-100 hover:text-slate-900 " +
    "focus-visible:ring-brand-500",
  danger:
    "mf-button--danger bg-red-600 text-white shadow-sm hover:bg-red-700 focus-visible:ring-red-500",
};

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: "px-2.5 py-1 text-xs",
  md: "px-3 py-1.5 text-sm",
};

export function Button({ variant = "primary", size = "md", className, ...rest }: ButtonProps) {
  const classes = ["mf-button", BASE_CLASS, VARIANT_CLASS[variant], SIZE_CLASS[size], className]
    .filter(Boolean)
    .join(" ");
  return <button className={classes} {...rest} />;
}
