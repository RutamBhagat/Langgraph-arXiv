import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().min(1),
    CORS_ORIGIN: z.url(),
    GOOGLE_API_KEY: z.string().min(1).optional(),
    LANGSMITH_API_KEY: z.string().min(1).optional(),
    LANGSMITH_PROJECT: z.string().min(1).optional(),
    LANGSMITH_TRACING: z.enum(["true", "false"]).optional(),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
