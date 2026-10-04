/**
 * One Firebase project (`mycarwashph`), two environments.
 *
 * Dev and prod share the project, Auth users and Cloud Functions deployment but
 * use separate Firestore named databases and separate function names:
 *
 *   env   database          shop API             partner API (/v1)        secret
 *   dev   mycarwash-dev     mycarwashApiDev      mycarwashPublicApiDev    API_KEY_PEPPER_DEV
 *   prod  mycarwash-prod    mycarwashApiProd     mycarwashPublicApiProd   API_KEY_PEPPER_PROD
 *
 * The web app's App Hosting backends (mycarwash-dev / mycarwash-prod) point at
 * the matching function URLs through apphosting.<env>.yaml.
 */
export type EnvName = "dev" | "prod";

export interface EnvDefinition {
  name: EnvName;
  /** Firestore named database ID. */
  databaseId: string;
  /** Secret Manager secret holding the /v1 API key pepper. */
  pepperSecret: string;
  /** Web origins allowed by CORS (App Hosting URL, custom domain, local dev). */
  allowedOrigins: string[];
}

export const PROJECT_ID = "mycarwashph";

export const ENVIRONMENTS: Record<EnvName, EnvDefinition> = {
  dev: {
    name: "dev",
    databaseId: "mycarwash-dev",
    pepperSecret: "API_KEY_PEPPER_DEV",
    allowedOrigins: [
      "https://mycarwash-dev--mycarwashph.asia-southeast1.hosted.app",
      "http://localhost:3000",
      "http://127.0.0.1:3000",
    ],
  },
  prod: {
    name: "prod",
    databaseId: "mycarwash-prod",
    pepperSecret: "API_KEY_PEPPER_PROD",
    allowedOrigins: [
      "https://mycarwash-prod--mycarwashph.asia-southeast1.hosted.app",
      "https://mycarwash.ph",
      "https://www.mycarwash.ph",
    ],
  },
};
