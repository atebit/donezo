import pino from "pino";
import { env } from "./env";

if (typeof window !== "undefined") {
  throw new Error("logger imported in client code; use a client-side logger instead");
}

// No pino-pretty transport: it spawns a worker thread whose module path
// gets rewritten by the Next.js server bundler and then can't be resolved
// at runtime. For pretty dev output, pipe stdout through pino-pretty.
export const logger = pino({
  level: env.NODE_ENV === "production" ? "info" : "debug",
});
