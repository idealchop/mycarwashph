import type { TokenVerifier } from "./auth/token-verifier.js";
import type { AppConfig } from "./config/env.js";
import type { DocStore } from "./store/doc-store.js";

/** Everything the API needs from the outside world; injected so tests can fake it. */
export interface Deps {
  store: DocStore;
  verifier: TokenVerifier;
  config: AppConfig;
  now: () => Date;
}
