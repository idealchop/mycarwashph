"use client";
import { useEffect, useId, useRef, useState, type InputHTMLAttributes } from "react";
import { cn } from "../cn";
import { FieldShell, type FieldProps } from "./Input";
import { formatPhilippineMobile, toE164Philippines } from "../phone";

export interface PhoneInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "defaultValue" | "onChange" | "size">, FieldProps {
  value?: string;
  defaultValue?: string;
  /** Called with the formatted national number and the E.164 value (null until complete). */
  onChange?: (formatted: string, e164: string | null) => void;
  countryCode?: string;
}

function PhFlag() {
  return (
    <span aria-hidden className="relative block h-[15px] w-[22px] overflow-hidden rounded-[3px]">
      <i className="absolute inset-x-0 top-0 h-1/2 bg-[#0038A8]" />
      <i className="absolute inset-x-0 bottom-0 h-1/2 bg-[#CE1126]" />
      <i className="absolute left-0 top-0 size-0 border-y-[7.5px] border-l-[12px] border-y-transparent border-l-white" />
    </span>
  );
}

/** Mobile number field with a fixed +63 (Philippines) prefix. Accepts 09…, 9… or +639… input. */
export function PhoneInput({ label = "Mobile number", hideLabel, hint, error, value, defaultValue, onChange, countryCode = "+63", id, className, autoFocus, ...rest }: PhoneInputProps) {
  const auto = useId();
  const ref = useRef<HTMLInputElement>(null);
  // Focus after hydration too (the autoFocus attribute alone is ignored for server-rendered inputs).
  useEffect(() => { if (autoFocus) ref.current?.focus(); }, [autoFocus]);
  const fid = id ?? auto;
  const [inner, setInner] = useState(formatPhilippineMobile(defaultValue ?? ""));
  const shown = value !== undefined ? formatPhilippineMobile(value) : inner;
  return (
    <FieldShell id={fid} label={label} hideLabel={hideLabel} hint={hint} error={error}>
      <div className={cn("flex h-[62px] items-center rounded-[18px] bg-canvas px-2 focus-within:bg-surface focus-within:ring-2 focus-within:ring-ink", error && "ring-2 ring-ink")}>
        <span className="flex h-11 flex-none items-center gap-[7px] rounded-[12px] bg-grey-100 px-3 text-[16px] font-bold">
          <PhFlag />{countryCode}
        </span>
        <input
          ref={ref}
          id={fid}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${fid}-error` : hint ? `${fid}-hint` : undefined}
          value={shown}
          onChange={(e) => {
            const f = formatPhilippineMobile(e.target.value);
            setInner(f);
            onChange?.(f, toE164Philippines(f));
          }}
          className={cn("min-w-0 flex-1 bg-transparent pl-3.5 text-[19px] font-bold tracking-[0.01em] text-ink caret-ink outline-none placeholder:text-subtle", className)}
          placeholder="917 123 4567"
          {...rest}
        />
      </div>
    </FieldShell>
  );
}
