import { LogoMark } from "@river-apps/ui";

/** Mycarwash.ph wordmark with the water-drop glyph. */
export function MycarwashBrand({ size = 34 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark size={size}>
        <svg viewBox="0 0 24 24" aria-hidden>
          <path d="M12 3 17.2 10.6A6.4 6.4 0 1 1 6.8 10.6Z" fill="#fff" />
          <path d="M9.3 14.4a2.9 2.9 0 0 0 2.2 2.7" stroke="#0A0A0A" strokeWidth="1.5" strokeLinecap="round" fill="none" />
        </svg>
      </LogoMark>
      <span className="text-[19px] font-extrabold tracking-[-0.02em]">
        Mycarwash<span className="font-semibold text-subtle">.ph</span>
      </span>
    </span>
  );
}

export function GoogleG() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
