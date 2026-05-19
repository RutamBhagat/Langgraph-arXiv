import { db, eq, sql, cosineDistance, desc } from "@skyclad_langgraph/db";
import { paperDocuments } from "@skyclad_langgraph/db/schema/index";
import { tool } from "langchain";
import { z } from "zod";
import {
  DOCUMENT_VECTOR_LIMIT,
  LEXICAL_LIMIT,
  TOP_DOCUMENT_CHUNKS,
  RRF_K,
  embeddings,
} from "./arxivShared.js";

export const queryArxivPaperDocs = tool(
  async ({ paperId, question }) => {
    try {
      const questionEmbedding = await embeddings.embedQuery(question);

      const semanticSimilarity = sql<number>`1 - (${cosineDistance(paperDocuments.embedding, questionEmbedding)})`;
      const semanticRows = await db
        .select({
          documentId: paperDocuments.id,
          score: semanticSimilarity,
        })
        .from(paperDocuments)
        .where(eq(paperDocuments.paperId, paperId))
        .orderBy((table) => desc(table.score))
        .limit(DOCUMENT_VECTOR_LIMIT);

      const lexicalRows = await db
        .select({
          documentId: paperDocuments.id,
          score: sql<number>`ts_rank_cd(${paperDocuments.pageContentSearch}, plainto_tsquery('english', ${question}))`,
        })
        .from(paperDocuments)
        .where(
          sql`${paperDocuments.paperId} = ${paperId} AND ${paperDocuments.pageContentSearch} @@ plainto_tsquery('english', ${question})`,
        )
        .orderBy((table) => desc(table.score))
        .limit(LEXICAL_LIMIT);

      const fusedScoresByDocumentId = new Map<string, number>();
      for (const [rank, row] of semanticRows.entries()) {
        const currentScore = fusedScoresByDocumentId.get(row.documentId) ?? 0;
        fusedScoresByDocumentId.set(
          row.documentId,
          currentScore + 1 / (RRF_K + rank + 1),
        );
      }
      for (const [rank, row] of lexicalRows.entries()) {
        const currentScore = fusedScoresByDocumentId.get(row.documentId) ?? 0;
        fusedScoresByDocumentId.set(
          row.documentId,
          currentScore + 1 / (RRF_K + rank + 1),
        );
      }

      const rankedDocumentIds = [...fusedScoresByDocumentId.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, TOP_DOCUMENT_CHUNKS)
        .map(([documentId]) => documentId);

      if (rankedDocumentIds.length === 0) {
        return { status: "no_matches", chunks: [] };
      }

      const documents = await db
        .select({
          id: paperDocuments.id,
          paperId: paperDocuments.paperId,
          chunkIndex: paperDocuments.chunkIndex,
          pageContent: paperDocuments.pageContent,
        })
        .from(paperDocuments)
        .where(sql`${paperDocuments.id} = ANY(${rankedDocumentIds})`);

      const documentById = new Map(
        documents.map((documentChunk) => [documentChunk.id, documentChunk]),
      );
      const orderedTopChunks = rankedDocumentIds
        .map((documentId) => documentById.get(documentId))
        .filter(
          (documentChunk): documentChunk is NonNullable<typeof documentChunk> =>
            documentChunk !== undefined,
        );

      return {
        status: "ok",
        chunks: orderedTopChunks,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return `Error querying arXiv paper docs: ${message}`;
    }
  },
  {
    name: "query_arxiv_paper_docs",
    description:
      "Query only the specified ingested paper by paperId and return top document chunks using hybrid semantic + lexical retrieval.",
    schema: z.object({
      paperId: z
        .string()
        .min(1)
        .describe("Resolved paper ID returned from resolve_arxiv_paper"),
      question: z
        .string()
        .min(1)
        .describe("Question to answer from the resolved paper"),
    }),
  },
);
