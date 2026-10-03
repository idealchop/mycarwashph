import { onRequest } from "firebase-functions/v2/https";
import { createApp } from "./app.js";
import { brand } from "./config/brand.js";

export const mycarwashApi = onRequest({ region: brand.region }, createApp());
