"use client";
import { useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "../cn";

export interface FieldProps {
  label?: ReactNode;
  /** Visually hide the label but keep it for screen readers. */
  hideLabel?: boolean;
  hint?: ReactNode;
  error?: ReactNode;
}

export function FieldShell({ id, label, hideLabel, hint, error, children, className }: FieldProps & { id: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col", className)}>
      {label ? <label htmlFor={id} className={cn("mb-2 text-[14px] font-bold", hideLabel && "sr-only")}>{label}</label> : null}
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-3 flex items-center gap-1.5 text-[13.5px] font-semibold text-ink"><span aria-hidden>⚠︎</span>{error}</p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-3 flex items-center gap-1.5 text-[13.5px] font-medium text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size">, FieldProps {
  leadingIcon?: ReactNode;
  trailing?: ReactNode;
  size?: "md" | "lg";
  containerClassName?: string;
}

/** Large rounded text field. Grey at rest; white with a 2px black ring when focused. */
export function Input({ label, hideLabel, hint, error, leadingIcon, trailing, size = "lg", id, className, containerClassName, ...rest }: InputProps) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <FieldShell id={fid} label={label} hideLabel={hideLabel} hint={hint} error={error} className={containerClassName}>
      <div
        className={cn(
          "flex items-center gap-2.5 bg-canvas px-4 transition-shadow focus-within:bg-surface focus-within:ring-2 focus-within:ring-ink",
          size === "lg" ? "h-[62px] rounded-[18px]" : "h-[46px] rounded-tile",
          error && "ring-2 ring-ink",
        )}
      >
        {leadingIcon ? <span className="text-subtle">{leadingIcon}</span> : null}
        <input
          id={fid}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${fid}-error` : hint ? `${fid}-hint` : undefined}
          className={cn("min-w-0 flex-1 bg-transparent font-semibold text-ink outline-none placeholder:font-medium placeholder:text-subtle", size === "lg" ? "text-[18px]" : "text-[14px]", className)}
          {...rest}
        />
        {trailing}
      </div>
    </FieldShell>
  );
}

export interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> { label?: string; className?: string }
/** White search field with a soft shadow, for top bars. */
export function SearchInput({ label = "Search", placeholder = "Search", className, ...rest }: SearchInputProps) {
  return (
    <label className={cn("flex h-[46px] items-center gap-2.5 rounded-tile bg-surface px-4 text-subtle shadow-card focus-within:ring-2 focus-within:ring-ink", className)}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
      <span className="sr-only">{label}</span>
      <input type="search" placeholder={placeholder} className="min-w-0 flex-1 bg-transparent text-[14px] font-medium text-ink outline-none placeholder:text-subtle" {...rest} />
    </label>
  );
}
