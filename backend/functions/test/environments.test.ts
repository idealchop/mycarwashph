import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config/env.js";
import { APP_HOSTING_SERVICE_ACCOUNT, ENVIRONMENTS, PROJECT_ID, cloudRunUrl } from "../src/config/environments.js";

describe("single project, two environments", () => {
  it("uses one project and a separate named database per environment", () => {
    expect(PROJECT_ID).toBe("mycarwashph");
    expect(ENVIRONMENTS.dev.databaseId).toBe("mycarwash-dev");
    expect(ENVIRONMENTS.prod.databaseId).toBe("mycarwash-prod");
    expect(ENVIRONMENTS.dev.pepperSecret).not.toBe(ENVIRONMENTS.prod.pepperSecret);
  });

  it("never allows localhost origins in prod", () => {
    expect(ENVIRONMENTS.prod.allowedOrigins.some((o) => o.includes("localhost") || o.includes("127.0.0.1"))).toBe(false);
  });

  it("lets ALLOWED_ORIGINS override the defaults", () => {
    const c = loadConfig({ allowedOrigins: ["https://a"], apiKeyPepper: "p" }, { ALLOWED_ORIGINS: "https://b, https://c" });
    expect(c.allowedOrigins).toEqual(["https://b", "https://c"]);
    expect(loadConfig({ allowedOrigins: ["https://a"], apiKeyPepper: "p" }, {}).allowedOrigins).toEqual(["https://a"]);
  });

  it("derives the private Cloud Run URL the App Hosting proxy calls", () => {
    expect(cloudRunUrl("mycarwashApiDev")).toBe("https://mycarwashapidev-o4uz6gedqa-as.a.run.app");
    expect(APP_HOSTING_SERVICE_ACCOUNT).toBe("firebase-app-hosting-compute@mycarwashph.iam.gserviceaccount.com");
  });
});
