// Generates CSS variables, a Tailwind 4 @theme, @font-face rules, JSON and a typed JS export
// from src/tokens.json. No dependencies.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const t = JSON.parse(readFileSync(join(root, "src/tokens.json"), "utf8"));
delete t.$description;
const out = join(root, "dist");
mkdirSync(out, { recursive: true });
const header = "/* River Apps UI Kit tokens. Generated from src/tokens.json; do not edit by hand. */\n";

// 1) Plain CSS variables (framework-agnostic), prefixed --ra-
const v = [];
for (const [k, val] of Object.entries(t.color)) v.push(`  --ra-color-${k}: ${val};`);
for (const [k, val] of Object.entries(t.radius)) v.push(`  --ra-radius-${k}: ${val};`);
for (const [k, val] of Object.entries(t.shadow)) v.push(`  --ra-shadow-${k}: ${val};`);
for (const [k, val] of Object.entries(t.space)) v.push(`  --ra-space-${k}: ${val};`);
for (const [k, val] of Object.entries(t.font)) v.push(`  --ra-font-${k}: ${val};`);
for (const [k, s] of Object.entries(t.text)) {
  v.push(`  --ra-text-${k}-size: ${s.size};`, `  --ra-text-${k}-line-height: ${s.lineHeight};`,
    `  --ra-text-${k}-weight: ${s.weight};`, `  --ra-text-${k}-letter-spacing: ${s.letterSpacing};`);
}
for (const [k, val] of Object.entries(t.size)) v.push(`  --ra-size-${k}: ${val};`);
writeFileSync(join(out, "tokens.css"), `${header}:root {\n${v.join("\n")}\n}\n`);

// 2) Tailwind 4 theme. Import after "tailwindcss": @import "@river-apps/tokens/theme.css";
const th = [];
for (const [k, val] of Object.entries(t.color)) th.push(`  --color-${k}: ${val};`);
for (const [k, val] of Object.entries(t.radius)) th.push(`  --radius-${k}: ${val};`);
for (const [k, val] of Object.entries(t.shadow)) th.push(`  --shadow-${k}: ${val};`);
th.push(`  --font-sans: ${t.font.sans};`, `  --font-mono: ${t.font.mono};`);
for (const [k, s] of Object.entries(t.text)) {
  th.push(`  --text-${k}: ${s.size};`, `  --text-${k}--line-height: ${s.lineHeight};`,
    `  --text-${k}--letter-spacing: ${s.letterSpacing};`, `  --text-${k}--font-weight: ${s.weight};`);
}
for (const [k, val] of Object.entries(t.size)) th.push(`  --spacing-${k}: ${val};`);
writeFileSync(join(out, "theme.css"), `${header}@theme {\n${th.join("\n")}\n}\n`);

// 3) Fonts (OFL 1.1, see fonts/OFL.txt)
writeFileSync(join(out, "fonts.css"), `${header}@font-face {
  font-family: "Plus Jakarta Sans";
  src: url("../fonts/PlusJakartaSans-Variable.woff2") format("woff2");
  font-weight: 200 800;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: "Geist Mono";
  src: url("../fonts/GeistMono-Variable-LatinSubset.woff2") format("woff2");
  font-weight: 100 900;
  font-style: normal;
  font-display: swap;
}
`);

// 4) JSON + typed JS
writeFileSync(join(out, "tokens.json"), JSON.stringify(t, null, 2) + "\n");
writeFileSync(join(out, "index.js"), `export const tokens = ${JSON.stringify(t, null, 2)};\nexport default tokens;\n`);
const dts = (o, ind = "  ") => "{\n" + Object.entries(o).map(([k, val]) =>
  `${ind}readonly ${JSON.stringify(k)}: ${typeof val === "object" ? dts(val, ind + "  ") : "string"};`).join("\n") + `\n${ind.slice(2)}}`;
writeFileSync(join(out, "index.d.ts"), `export declare const tokens: ${dts(t)};\nexport default tokens;\nexport type Tokens = typeof tokens;\nexport type ColorToken = keyof typeof tokens.color;\n`);
console.log("tokens: wrote dist/{tokens.css,theme.css,fonts.css,tokens.json,index.js,index.d.ts}");
