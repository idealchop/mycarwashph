/**
 * Companion mark (shared with Barbers.ph): an original glyph derived from the River smile. A bold,
 * round-capped smile with a four-point spark above its right corner. Ink colour, no tile.
 * Drawn on a 32-unit grid with one stroke weight so it stays crisp at 20-56px.
 */
export function CompanionMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden className={className} fill="none">
      <path className="cm-smile" d="M5 14.5C8.2 21.6 13 24 16.4 24c3.6 0 7.4-2.4 10.1-7.6" stroke="currentColor" strokeWidth="3.6" strokeLinecap="round" />
      <path className="cm-spark" d="M24.5 3.5c.45 2.7 1.3 3.55 4 4-2.7.45-3.55 1.3-4 4-.45-2.7-1.3-3.55-4-4 2.7-.45 3.55-1.3 4-4Z" fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
    </svg>
  );
}

/** The Companion's face. "idle" breathes softly; "thinking" waves the smile and twinkles the spark; "still" for small inline use. */
export function CompanionAvatar({ size = 36, state = "idle" }: { size?: number; state?: "idle" | "thinking" | "still" }) {
  return (
    <span aria-hidden className={`companion-face companion-${state} inline-flex flex-none items-center justify-center text-ink`} style={{ width: size, height: size }}>
      <CompanionMark size={size} />
    </span>
  );
}
