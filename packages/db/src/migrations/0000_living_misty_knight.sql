
CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TABLE "paper_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"paper_id" text NOT NULL,
	"chunk_index" integer NOT NULL,
	"page_content" text NOT NULL,
	"embedding" vector(1536) NOT NULL,
	"page_content_search" "tsvector" GENERATED ALWAYS AS (to_tsvector('english', "paper_documents"."page_content")) STORED NOT NULL
);
--> statement-breakpoint
CREATE TABLE "papers" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"authors" jsonb NOT NULL,
	"published_at" timestamp with time zone,
	"updated_at" timestamp with time zone,
	"summary" text NOT NULL,
	"summary_embedding" vector(1536) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "paper_documents" ADD CONSTRAINT "paper_documents_paper_id_papers_id_fk" FOREIGN KEY ("paper_id") REFERENCES "public"."papers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "paper_documents_embedding_hnsw_idx" ON "paper_documents" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "paper_documents_page_content_search_gin_idx" ON "paper_documents" USING gin ("page_content_search");--> statement-breakpoint
CREATE INDEX "paper_documents_paper_id_idx" ON "paper_documents" USING btree ("paper_id");--> statement-breakpoint
CREATE INDEX "papers_summary_embedding_hnsw_idx" ON "papers" USING hnsw ("summary_embedding" vector_cosine_ops);
