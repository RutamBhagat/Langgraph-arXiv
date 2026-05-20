import { OllamaEmbeddings } from "@langchain/ollama";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { env } from "@skyclad_langgraph/env/server";
import { Gemini1536Embeddings } from "./gemini1536Embeddings.js";

export const DOCUMENT_VECTOR_LIMIT = 80;
export const LEXICAL_LIMIT = 80;
export const TOP_DOCUMENT_CHUNKS = 3;
export const RRF_K = 60;

export const embeddings =
  env.EMBEDDINGS_MODEL === "qwen3-embedding:8b"
    ? new OllamaEmbeddings({
        model: "qwen3-embedding:8b",
        dimensions: 1536,
        baseUrl: "http://localhost:11434",
      })
    : env.GOOGLE_API_KEY
      ? new Gemini1536Embeddings({
          model: "gemini-embedding-2",
          apiKey: env.GOOGLE_API_KEY,
        })
      : (() => {
          throw new Error(
            "GOOGLE_API_KEY is required when EMBEDDINGS_MODEL is not qwen3-embedding:8b.",
          );
        })();

export const documentSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 3000,
  chunkOverlap: 100,
});

export function parseDate(value: unknown): Date | null {
  if (typeof value !== "string" || value.length === 0) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) {
    return null;
  }
  return parsed;
}
