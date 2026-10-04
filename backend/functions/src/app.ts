import express from "express";
import { brand } from "./config/brand.js";
import type { Deps } from "./deps.js";
import { requireAuth } from "./middleware/auth-middleware.js";
import { errorHandler, notFoundHandler } from "./middleware/error-middleware.js";
import { cors, limiter } from "./middleware/http-middleware.js";
import { businessRoutes } from "./routes/business-routes.js";
import { meRoutes } from "./routes/me-routes.js";
import { publicRoutes } from "./routes/v1/public-routes.js";

function base() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(express.json({ limit: "100kb" }));
  return app;
}

/** Shop app API (owners and staff, Firebase ID tokens). Functions: mycarwashApiDev / mycarwashApiProd. */
export function createApp(deps: Deps) {
  const app = base();
  app.use(cors(deps.config));
  app.get("/health", (_req, res) => void res.json({ ok: true, service: `${brand.slug}-api` }));
  app.use(limiter(deps.config, 300));
  app.use(requireAuth(deps.verifier));
  app.use(meRoutes(deps));
  app.use("/businesses/:businessId", businessRoutes(deps));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

/** Public partner API for River Mobile (server to server). Functions: mycarwashPublicApiDev / mycarwashPublicApiProd. */
export function createPublicApp(deps: Deps) {
  const app = base();
  app.use(limiter(deps.config, 120));
  app.use("/v1", publicRoutes(deps));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
