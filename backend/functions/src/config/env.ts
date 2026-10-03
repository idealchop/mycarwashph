/**
 * Runtime configuration from environment variables. Real values live in
 * backend/functions/.env.<project-id> (git-ignored) or Secret Manager.
 * See backend/functions/.env.example.
 */
export interface AppConfig {
  allowedOrigins: string[];
  apiKeyPepper: string;
  /** Disable rate limiting (unit tests only). */
  disableRateLimit: boolean;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    allowedOrigins: (env.ALLOWED_ORIGINS ?? "http://localhost:3000,http://127.0.0.1:3000")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    apiKeyPepper: env.API_KEY_PEPPER ?? "local-dev-pepper",
    disableRateLimit: env.DISABLE_RATE_LIMIT === "true",
  };
}
