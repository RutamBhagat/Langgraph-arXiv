import { db, eq } from "@skyclad_langgraph/db";
import { paperDocuments, papers } from "@skyclad_langgraph/db/schema/index";
import { ArxivRetriever } from "@langchain/community/retrievers/arxiv";
import { tool } from "langchain";
import { z } from "zod";
import { documentSplitter, embeddings, parseDate } from "./arxivShared.js";

// db ingestion null char edge case
function removeNullBytes(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\u0000/g, "");
}

// prevents bloated error logs
function getSafeErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return "Unknown error";
  }
  const cleaned = error.message
    .replace(/\nparams:\s[\s\S]*$/i, "")
    .replace(/^Failed query:[\s\S]*$/i, "Database write failed");

  const errorWithCause = error as { cause?: unknown };
  if (
    cleaned === "Database write failed" &&
    errorWithCause.cause instanceof Error
  ) {
    return `Database write failed: ${errorWithCause.cause.message}`;
  }

  return cleaned;
}

export const downloadArxivPaper = tool(
  async ({ arxivId }) => {
    try {
      console.log(`[download_arxiv_paper] checking database for ${arxivId}`);
      const existingPaper = await db
        .select({
          paperId: papers.id,
          title: papers.title,
        })
        .from(papers)
        .where(eq(papers.id, arxivId))
        .limit(1);

      if (existingPaper.length > 0) {
        console.log(`[download_arxiv_paper] already ingested ${arxivId}`);
        return {
          status: "skipped_existing",
          ...existingPaper[0],
        };
      }

      console.log(
        `[download_arxiv_paper] creating arXiv retriever for ${arxivId}`,
      );
      const retriever = new ArxivRetriever({
        getFullDocuments: true,
        maxSearchResults: 1,
      });
      console.log(`[download_arxiv_paper] fetching arXiv document for ${arxivId}`);
      const documents = await retriever.invoke(arxivId);
      console.log(
        `[download_arxiv_paper] arXiv returned ${documents.length} document(s) for ${arxivId}`,
      );

      if (documents.length === 0) {
        console.log(
          `[download_arxiv_paper] no arXiv document found for ${arxivId}`,
        );
        return { status: "not_found", arxivId: arxivId };
      }

      const firstDocument = documents[0];
      const metadata = firstDocument.metadata as {
        title: string;
        authors: string[];
        published: string;
        updated: string;
        summary: string;
      };

      const safeMetadata = {
        title: removeNullBytes(metadata.title),
        authors: metadata.authors.map((author) => removeNullBytes(author)),
        published: metadata.published,
        updated: metadata.updated,
        summary: removeNullBytes(metadata.summary),
      };
      const safePageContent = removeNullBytes(firstDocument.pageContent);
      console.log(
        `[download_arxiv_paper] cleaned arXiv document for ${arxivId} (${safePageContent.length} chars)`,
      );

      const paperEmbeddingText = [
        safeMetadata.title,
        safeMetadata.authors.join(", "),
        safeMetadata.summary,
      ]
        .filter((value) => value.trim().length > 0)
        .join("\n\n");

      console.log(`[download_arxiv_paper] embedding summary for ${arxivId}`);
      const summaryEmbedding = await embeddings.embedQuery(paperEmbeddingText);
      console.log(`[download_arxiv_paper] embedded summary for ${arxivId}`);

      console.log(`[download_arxiv_paper] splitting document for ${arxivId}`);
      const preparedDocuments = (
        await documentSplitter.splitText(safePageContent)
      ).map((pageContent, chunkIndex) => ({
        chunkIndex,
        pageContent,
      }));
      console.log(
        `[download_arxiv_paper] split ${arxivId} into ${preparedDocuments.length} chunk(s)`,
      );

      const documentEmbeddings =
        preparedDocuments.length === 0
          ? []
          : await embeddings.embedDocuments(
              preparedDocuments.map(
                (documentChunk) => documentChunk.pageContent,
              ),
            );

      const insertedPaper = await db.transaction(async (tx) => {
        const insertedPapers = await tx
          .insert(papers)
          .values({
            id: arxivId,
            title: safeMetadata.title,
            authors: safeMetadata.authors,
            publishedAt: parseDate(safeMetadata.published),
            updatedAt: parseDate(safeMetadata.updated),
            summary: paperEmbeddingText,
            summaryEmbedding,
          })
          .returning({
            id: papers.id,
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
        title: insertedPaper.title,
      };
    } catch (error) {
      const message = getSafeErrorMessage(error);
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
