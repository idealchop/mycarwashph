/**
 * Runtime configuration for one environment (dev or prod). Non-secret values come
 * from config/environments.ts and can be overridden with env vars; the API key
 * pepper comes from Secret Manager (see index.ts).
 */
export interface AppConfig {
  allowedOrigins: string[];
  apiKeyPepper: string;
  /** Disable rate limiting (unit tests only). */
  disableRateLimit: boolean;
  /** Environment name used in logs (dev / prod / test). */
  envName?: string;
  /** AI Companion on/off for this environment (prod stays off until approved). */
  companionEnabled?: boolean;
  /** Dev-only tools (demo data seeding). Never true in prod. */
  devTools?: boolean;
}

export function loadConfig(
  defaults: { allowedOrigins: string[]; apiKeyPepper: string; envName?: string; companionEnabled?: boolean; devTools?: boolean },
  env: NodeJS.ProcessEnv = process.env,
): AppConfig {
  const origins = env.ALLOWED_ORIGINS?.split(",").map((s) => s.trim()).filter(Boolean);
  return {
    allowedOrigins: origins?.length ? origins : defaults.allowedOrigins,
    apiKeyPepper: defaults.apiKeyPepper,
    disableRateLimit: env.DISABLE_RATE_LIMIT === "true",
    envName: defaults.envName,
    companionEnabled: defaults.companionEnabled ?? false,
    devTools: defaults.devTools ?? false,
  };
}
