import { SQL, sql } from "drizzle-orm";
import {
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  vector,
} from "drizzle-orm/pg-core";

const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

export const papers = pgTable(
  "papers",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    authors: jsonb("authors").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
    summary: text("summary").notNull(),
    summaryEmbedding: vector("summary_embedding", { dimensions: 1536 }).notNull(),
  },
  (table) => [
    index("papers_summary_embedding_hnsw_idx").using(
      "hnsw",
      table.summaryEmbedding.op("vector_cosine_ops"),
    ),
  ],
);

export const paperDocuments = pgTable(
  "paper_documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    paperId: text("paper_id")
      .notNull()
      .references(() => papers.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(),
    pageContent: text("page_content").notNull(),
    embedding: vector("embedding", { dimensions: 1536 }).notNull(),
    pageContentSearch: tsvector("page_content_search")
      .notNull()
      .generatedAlwaysAs(
        (): SQL => sql`to_tsvector('english', ${paperDocuments.pageContent})`,
      ),
  },
  (table) => [
    index("paper_documents_embedding_hnsw_idx").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops"),
    ),
    index("paper_documents_page_content_search_gin_idx").using("gin", table.pageContentSearch),
    index("paper_documents_paper_id_idx").on(table.paperId),
  ],
);
