// Root ESLint flat config for the whole workspace.
import js from "@eslint/js";
import nextVitals from "eslint-config-next/core-web-vitals";
import globals from "globals";
import tseslint from "typescript-eslint";

const frontendFiles = ["frontend/**/*.{ts,tsx,js,jsx,mjs}"];

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/next-env.d.ts",
      "packages/**", // vendored River Apps UI Kit (linted upstream)
      "**/coverage/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node } },
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  {
    // Vendored River bridge-kit (idealchop/River-Mobile-App bridge-kit/src): keep it byte-for-byte.
    files: ["backend/functions/src/river/bridge-kit/**"],
    rules: { "prefer-const": "off" },
  },
  ...nextVitals.map((config) => ({
    ...config,
    files: config.files ?? frontendFiles,
    settings: { ...(config.settings ?? {}), next: { rootDir: "frontend/" }, react: { version: "19.2" } },
  })),
  {
    files: frontendFiles,
    languageOptions: { globals: { ...globals.browser } },
  },
);
