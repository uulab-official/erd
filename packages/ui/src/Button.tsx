import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: "mf-button--primary",
  secondary: "mf-button--secondary",
  ghost: "mf-button--ghost",
  danger: "mf-button--danger",
};

export function Button({ variant = "primary", className, ...rest }: ButtonProps) {
  const classes = ["mf-button", VARIANT_CLASS[variant], className].filter(Boolean).join(" ");
  return <button className={classes} {...rest} />;
}
