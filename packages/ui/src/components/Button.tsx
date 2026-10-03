import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../cn";

export type ButtonVariant = "primary" | "secondary" | "white" | "ghost" | "ghost-inverse";
export type ButtonSize = "xs" | "sm" | "md" | "lg";

interface Common {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Rounded-full pill instead of the standard rounded rectangle. */
  pill?: boolean;
  fullWidth?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  children?: ReactNode;
  className?: string;
}
export type ButtonProps = Common &
  (({ href?: undefined } & ButtonHTMLAttributes<HTMLButtonElement>) | ({ href: string } & AnchorHTMLAttributes<HTMLAnchorElement>));

const variants: Record<ButtonVariant, string> = {
  primary: "bg-ink text-on-ink shadow-button hover:bg-[#1F1F22] active:translate-y-px",
  secondary: "bg-surface text-ink ring-[1.5px] ring-inset ring-grey-200 hover:bg-grey-50",
  white: "bg-surface text-ink shadow-button-white hover:bg-grey-100",
  ghost: "bg-transparent text-ink hover:bg-grey-100",
  "ghost-inverse": "bg-on-ink-subtle/70 text-on-ink ring-1 ring-inset ring-on-ink-line hover:bg-on-ink-subtle",
};
const sizes: Record<ButtonSize, string> = {
  xs: "h-[30px] px-3 text-[12.5px] gap-1.5 rounded-sm",
  sm: "h-9 px-3.5 text-[13.5px] gap-1.5 rounded-[12px]",
  md: "h-[46px] px-5 text-[15px] gap-2 rounded-control",
  lg: "h-14 px-6 text-[16px] gap-2.5 rounded-tile",
};

/** Primary actions are black. Use one primary button per screen. Renders an <a> when `href` is set. */
export function Button(props: ButtonProps) {
  const { variant = "primary", size = "lg", pill, fullWidth, leadingIcon, trailingIcon, children, className, ...rest } = props;
  const cls = cn(
    "inline-flex select-none items-center justify-center whitespace-nowrap font-bold transition-colors",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:pointer-events-none disabled:opacity-45",
    variants[variant], sizes[size], pill && "rounded-pill", fullWidth && "w-full", className,
  );
  const inner = (<>{leadingIcon}{children}{trailingIcon}</>);
  if (typeof (rest as { href?: string }).href === "string") {
    return <a className={cls} {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)}>{inner}</a>;
  }
  const { type = "button", ...b } = rest as ButtonHTMLAttributes<HTMLButtonElement>;
  return <button type={type} className={cls} {...b}>{inner}</button>;
}
