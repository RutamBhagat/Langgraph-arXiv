import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().min(1),
    CORS_ORIGIN: z.url(),
    LANGGRAPH_API_URL: z.url().default("http://localhost:2024"),
    GOOGLE_API_KEY: z.string().min(1).optional(),
    EMBEDDINGS_MODEL: z.string().min(1).default("gemini-embedding-2"),
    OPENAI_PROXY_BASE_URL: z.url().optional(),
    OPENAI_API_KEY: z.string().min(1).optional(),
    LANGSMITH_API_KEY: z.string().min(1).optional(),
    LANGSMITH_PROJECT: z.string().min(1).optional(),
    LANGSMITH_TRACING: z.enum(["true", "false"]).optional(),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
