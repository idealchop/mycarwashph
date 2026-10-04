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
}

export function loadConfig(
  defaults: { allowedOrigins: string[]; apiKeyPepper: string },
  env: NodeJS.ProcessEnv = process.env,
): AppConfig {
  const origins = env.ALLOWED_ORIGINS?.split(",").map((s) => s.trim()).filter(Boolean);
  return {
    allowedOrigins: origins?.length ? origins : defaults.allowedOrigins,
    apiKeyPepper: defaults.apiKeyPepper,
    disableRateLimit: env.DISABLE_RATE_LIMIT === "true",
  };
}
