import {
  cosineDistance,
  db,
  desc,
  eq,
  inArray,
  sql,
} from "@skyclad_langgraph/db";
import { paperDocuments } from "@skyclad_langgraph/db/schema/index";
import { tool } from "langchain";
import { z } from "zod";
import { embeddings, TOP_DOCUMENT_CHUNKS } from "../arxivShared.js";

type QueryArxivPaperDocsInput = {
  paperId: string;
  question: string;
  lexicalQuery: string;
};

type RetrievedDocumentChunk = {
  id: string;
  paperId: string;
  chunkIndex: number;
  pageContent: string;
};

export type QueryArxivPaperDocsTool = ReturnType<typeof tool>;

const queryArxivPaperDocsSchema = z.object({
  paperId: z
    .string()
    .min(1)
    .describe("Resolved paper ID returned from resolve_arxiv_paper"),
  question: z
    .string()
    .min(1)
    .describe("Question to answer from the resolved paper"),
  lexicalQuery: z
    .string()
    .describe(
      "Agent-authored PostgreSQL websearch lexical query for exact recall. Pass an empty string when no useful exact terms are known.",
    ),
});

async function getOrderedDocumentChunks(
  rankedDocumentIds: string[],
): Promise<RetrievedDocumentChunk[]> {
  if (rankedDocumentIds.length === 0) {
    return [];
  }

  const documents = await db
    .select({
      id: paperDocuments.id,
      paperId: paperDocuments.paperId,
      chunkIndex: paperDocuments.chunkIndex,
      pageContent: paperDocuments.pageContent,
    })
    .from(paperDocuments)
    .where(inArray(paperDocuments.id, rankedDocumentIds));

  const documentById = new Map(
    documents.map((documentChunk) => [documentChunk.id, documentChunk]),
  );

  return rankedDocumentIds
    .map((documentId) => documentById.get(documentId))
    .filter(
      (documentChunk): documentChunk is RetrievedDocumentChunk =>
        documentChunk !== undefined,
    );
}

export const globalTopKQueryArxivPaperDocs = tool(
  async ({ question }: QueryArxivPaperDocsInput) => {
    try {
      const questionEmbedding = await embeddings.embedQuery(question);
      const semanticSimilarity = sql<number>`1 - (${cosineDistance(paperDocuments.embedding, questionEmbedding)})`;
      const rankedDocuments = await db
        .select({
          documentId: paperDocuments.id,
          score: semanticSimilarity,
        })
        .from(paperDocuments)
        .orderBy((table) => desc(table.score))
        .limit(TOP_DOCUMENT_CHUNKS);

      const rankedDocumentIds = rankedDocuments.map((row) => row.documentId);
      const chunks = await getOrderedDocumentChunks(rankedDocumentIds);

      return chunks.length === 0
        ? { status: "no_matches", chunks: [] }
        : { status: "ok", chunks };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return `Error querying arXiv paper docs: ${message}`;
    }
  },
  {
    name: "query_arxiv_paper_docs",
    description:
      "Query all ingested paper chunks globally and return the top document chunks using semantic retrieval.",
    schema: queryArxivPaperDocsSchema,
  },
);

export const namespaceTopKQueryArxivPaperDocs = tool(
  async ({ paperId, question }: QueryArxivPaperDocsInput) => {
    try {
      const questionEmbedding = await embeddings.embedQuery(question);
      const semanticSimilarity = sql<number>`1 - (${cosineDistance(paperDocuments.embedding, questionEmbedding)})`;
      const rankedDocuments = await db
        .select({
          documentId: paperDocuments.id,
          score: semanticSimilarity,
        })
        .from(paperDocuments)
        .where(eq(paperDocuments.paperId, paperId))
        .orderBy((table) => desc(table.score))
        .limit(TOP_DOCUMENT_CHUNKS);

      const rankedDocumentIds = rankedDocuments.map((row) => row.documentId);
      const chunks = await getOrderedDocumentChunks(rankedDocumentIds);

      return chunks.length === 0
        ? { status: "no_matches", chunks: [] }
        : { status: "ok", chunks };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return `Error querying arXiv paper docs: ${message}`;
    }
  },
  {
    name: "query_arxiv_paper_docs",
    description:
      "Query only the specified ingested paper by paperId and return the top document chunks using semantic retrieval.",
    schema: queryArxivPaperDocsSchema,
  },
);
