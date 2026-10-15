import { beforeEach } from "vitest";
import { setPlanGating } from "../src/config/plan-gating.js";

// Existing suites test today's (gated) behaviour; plan-gating.test.ts covers the flag off.
beforeEach(() => setPlanGating(true));
