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
 * Access: the smartrefill.io organisation policy (Domain restricted sharing)
 * forbids `allUsers` invokers, so the shop API functions are private Cloud Run
 * services that only the App Hosting backend service account may invoke. The web
 * app calls same-origin `/api/*` (frontend/app/api/[...path]/route.ts), which
 * forwards to the function with a Google ID token in X-Serverless-Authorization
 * and the user's Firebase ID token untouched in Authorization. The partner API
 * (/v1) stays private until River Mobile integration (Phase 1).
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
export const PROJECT_NUMBER = "430775059863";

/** Service account of both App Hosting backends; the only invoker of the shop API functions. */
export const APP_HOSTING_SERVICE_ACCOUNT = `firebase-app-hosting-compute@${PROJECT_ID}.iam.gserviceaccount.com`;

/**
 * Cloud Run URL of a Gen-2 function (what the App Hosting /api proxy calls).
 * The hash (`o4uz6gedqa`) is project-scoped and stable across redeploys; the
 * ID-token audience must match this URL exactly.
 */
export const CLOUD_RUN_URLS = {
  mycarwashApiDev: "https://mycarwashapidev-o4uz6gedqa-as.a.run.app",
  mycarwashApiProd: "https://mycarwashapiprod-o4uz6gedqa-as.a.run.app",
  mycarwashPublicApiDev: "https://mycarwashpublicapidev-o4uz6gedqa-as.a.run.app",
  mycarwashPublicApiProd: "https://mycarwashpublicapiprod-o4uz6gedqa-as.a.run.app",
} as const;

export const cloudRunUrl = (functionName: keyof typeof CLOUD_RUN_URLS) => CLOUD_RUN_URLS[functionName];

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
