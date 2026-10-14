"use client";

/** Last-resort boundary (root layout failed). Plain HTML: providers and fonts may not be loaded. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#F2F2F4", color: "#0A0A0A" }}>
        <main style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Mycarwash.ph hit a problem</h1>
          <p style={{ margin: 0, color: "#6B6B70" }}>Please reload. {error.digest ? `Ref: ${error.digest}` : ""}</p>
          <button onClick={() => reset()} style={{ marginTop: 8, height: 46, padding: "0 20px", borderRadius: 14, border: 0, background: "#0A0A0A", color: "#fff", fontWeight: 700, fontSize: 15 }}>
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
