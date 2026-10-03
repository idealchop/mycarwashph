"use client";
import { useEffect, useRef, useState } from "react";
import { cn } from "../cn";

export interface OtpInputProps {
  length?: number;
  value?: string;
  defaultValue?: string;
  onChange?: (code: string) => void;
  /** Fires once every box is filled. */
  onComplete?: (code: string) => void;
  autoFocus?: boolean;
  /** Accessible group label. */
  label?: string;
  error?: boolean;
  className?: string;
}

/** One-time code boxes. Supports typing, backspace, arrow keys and pasting the whole code. */
export function OtpInput({ length = 6, value, defaultValue = "", onChange, onComplete, autoFocus, label = "Verification code", error, className }: OtpInputProps) {
  const [inner, setInner] = useState(defaultValue.replace(/\D/g, "").slice(0, length));
  const code = (value ?? inner).replace(/\D/g, "").slice(0, length);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (autoFocus) refs.current[Math.min(code.length, length - 1)]?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (next: string) => {
    const v = next.replace(/\D/g, "").slice(0, length);
    setInner(v);
    onChange?.(v);
    if (v.length === length) onComplete?.(v);
    return v;
  };

  return (
    <div role="group" aria-label={label} className={cn("flex gap-2", className)}>
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          aria-label={`Digit ${i + 1} of ${length}`}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={length}
          value={code[i] ?? ""}
          onChange={(e) => {
            const typed = e.target.value.replace(/\D/g, "");
            if (!typed) return;
            const v = set(code.slice(0, i) + typed + code.slice(i + typed.length));
            refs.current[Math.min(i + typed.length, length - 1, v.length)]?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace") {
              e.preventDefault();
              if (code[i]) set(code.slice(0, i) + code.slice(i + 1));
              else if (i > 0) { set(code.slice(0, i - 1) + code.slice(i)); refs.current[i - 1]?.focus(); }
            } else if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
            else if (e.key === "ArrowRight" && i < length - 1) refs.current[i + 1]?.focus();
          }}
          onPaste={(e) => {
            e.preventDefault();
            const v = set(e.clipboardData.getData("text"));
            refs.current[Math.min(v.length, length - 1)]?.focus();
          }}
          className={cn(
            "h-[60px] w-[50px] min-w-0 rounded-tile bg-canvas text-center text-[24px] font-extrabold text-ink caret-ink outline-none transition-shadow",
            "focus:bg-surface focus:ring-2 focus:ring-ink",
            error && "ring-2 ring-ink",
          )}
        />
      ))}
    </div>
  );
}
