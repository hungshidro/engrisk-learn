ALTER TYPE "public"."question_type" ADD VALUE 'word_order';--> statement-breakpoint
ALTER TABLE "exercise_attempts" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "vocabulary_attempts" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;