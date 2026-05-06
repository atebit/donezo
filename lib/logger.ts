import pino from "pino";
import { env } from "./env";

if (typeof window !== "undefined") {
  throw new Error("logger imported in client code; use a client-side logger instead");
}

export const logger = pino(
  env.NODE_ENV === "production"
    ? { level: "info" }
    : { transport: { target: "pino-pretty", options: { colorize: true } } },
);
