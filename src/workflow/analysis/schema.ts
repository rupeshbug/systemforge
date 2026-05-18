import { z } from "zod";

export const AnalysisRouteSchema = z.enum([
  "pricing",
  "demo_request",
  "human_contact",
  "onboarding",
  "irrelevant",
  "clarification_required",
]);

export const AnalysisIntentSchema = z.enum([
  "pricing",
  "demo_request",
  "human_contact",
  "onboarding",
  "general_inquiry",
  "irrelevant",
  "clarification",
]);

export const ContactFieldSchema = z.enum([
  "name",
  "businessName",
  "email",
  "phone",
]);

export const ExtractedContactSchema = z.object({
  name: z.string().nullable(),
  businessName: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
});

export const MessageAnalysisSchema = z.object({
  route: AnalysisRouteSchema,
  intent: AnalysisIntentSchema,
  confidence: z.number().min(0).max(1),
  isBusinessRelevant: z.boolean(),
  requiresHumanReview: z.boolean(),
  userGoal: z.string().nullable(),
  summary: z.string(),
  missingContactFields: z.array(ContactFieldSchema),
  extractedContact: ExtractedContactSchema,
  responseText: z.string(),
});

export type MessageAnalysis = z.infer<typeof MessageAnalysisSchema>;
