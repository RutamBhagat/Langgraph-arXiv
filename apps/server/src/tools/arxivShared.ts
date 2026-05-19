import { OllamaEmbeddings } from "@langchain/ollama";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

export const DOCUMENT_VECTOR_LIMIT = 80;
export const LEXICAL_LIMIT = 80;
export const TOP_DOCUMENT_CHUNKS = 3;
export const RRF_K = 60;

export const embeddings = new OllamaEmbeddings({
  model: "qwen3-embedding:8b",
  dimensions: 1536,
  baseUrl: "http://localhost:11434", // can be changed if deployed on server, currently this is heavy, better option is to get gemini paid plan for embeddings, free plan has rate limits
});

export const documentSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 4000,
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
