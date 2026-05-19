ALTER TABLE "workflows" ADD COLUMN "qualification_stage" text DEFAULT 'collecting_information' NOT NULL;--> statement-breakpoint
ALTER TABLE "workflows" ADD COLUMN "lead_profile" text;--> statement-breakpoint
ALTER TABLE "workflows" ADD COLUMN "intent_signals" text;--> statement-breakpoint
ALTER TABLE "workflows" ADD COLUMN "interaction_state" text;