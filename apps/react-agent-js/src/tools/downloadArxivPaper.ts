import { db, eq } from "@skyclad_langgraph/db";
import { paperDocuments, papers } from "@skyclad_langgraph/db/schema/index";
import { ArxivRetriever } from "@langchain/community/retrievers/arxiv";
import { tool } from "langchain";
import { z } from "zod";
import { documentSplitter, embeddings, parseDate } from "./arxivShared.js";

export const downloadArxivPaper = tool(
  async ({ arxivId }) => {
    try {
      const existingPaper = await db
        .select({
          paperId: papers.id,
          arxivId: papers.arxivId,
          title: papers.title,
        })
        .from(papers)
        .where(eq(papers.arxivId, arxivId))
        .limit(1);

      if (existingPaper.length > 0) {
        return {
          status: "skipped_existing",
          ...existingPaper[0],
        };
      }

      const retriever = new ArxivRetriever({
        getFullDocuments: true,
        maxSearchResults: 1,
      });
      const documents = await retriever.invoke(arxivId);

      if (documents.length === 0) {
        return { status: "not_found", arxivId: arxivId };
      }

      const firstDocument = documents[0];
      const metadata = firstDocument.metadata as {
        title: string;
        authors: string[];
        published: string;
        updated: string;
        url: string;
        summary: string;
      };

      const summaryEmbedding = await embeddings.embedQuery(metadata.summary);

      const preparedDocuments = (
        await documentSplitter.splitText(firstDocument.pageContent)
      ).map((pageContent, chunkIndex) => ({
        chunkIndex,
        pageContent,
      }));

      const documentEmbeddings =
        preparedDocuments.length === 0
          ? []
          : await embeddings.embedDocuments(
              preparedDocuments.map((documentChunk) => documentChunk.pageContent),
            );

      const insertedPaper = await db.transaction(async (tx) => {
        const insertedPapers = await tx
          .insert(papers)
          .values({
            arxivId: arxivId,
            title: metadata.title,
            authors: metadata.authors,
            publishedAt: parseDate(metadata.published),
            updatedAt: parseDate(metadata.updated),
            url: metadata.url,
            summary: metadata.summary,
            summaryEmbedding,
          })
          .returning({
            id: papers.id,
            arxivId: papers.arxivId,
            title: papers.title,
          });

        const paper = insertedPapers[0];

        if (!paper) {
          throw new Error("Failed to insert paper");
        }

        if (preparedDocuments.length > 0) {
          await tx.insert(paperDocuments).values(
            preparedDocuments.map((documentChunk, index) => {
              const embedding = documentEmbeddings[index];
              if (!embedding) {
                throw new Error(
                  `Missing embedding for chunk index ${documentChunk.chunkIndex} in paper ${paper.id}`,
                );
              }
              return {
                paperId: paper.id,
                chunkIndex: documentChunk.chunkIndex,
                pageContent: documentChunk.pageContent,
                embedding,
              };
            }),
          );
        }

        return paper;
      });

      return {
        status: "ingested",
        paperId: insertedPaper.id,
        arxivId: insertedPaper.arxivId,
        title: insertedPaper.title,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return `Error ingesting arXiv paper: ${message}`;
    }
  },
  {
    name: "download_arxiv_paper",
    description:
      "Fetch an arXiv paper by ID and ingest it into the database with summary + document embeddings.",
    schema: z.object({
      arxivId: z
        .string()
        .min(1)
        .describe("The arXiv ID, e.g. '1706.03762' or '2401.12345'"),
    }),
  },
);
