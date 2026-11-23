import { printChecks, runAppConformance } from "./checklist.js";

/** `pnpm --filter @mycarwash/functions conformance`: the bridge-kit checklist against this app's /v1. */
async function main(): Promise<void> {
  const code = printChecks(await runAppConformance());
  process.exit(code);
}

void main();
