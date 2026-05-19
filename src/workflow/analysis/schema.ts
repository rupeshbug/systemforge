import { z } from "zod";
import {
  ContactFieldSchema,
  InteractionStatePatchSchema,
  LeadProfilePatchSchema,
  QualificationStageSchema,
  IntentSignalsPatchSchema,
} from "@/src/workflow/memory";

export const AnalysisRouteSchema = z.enum([
  "pricing",
  "demo_request",
  "human_contact",
  "onboarding",
  "irrelevant",
  "clarification_required",
]);

export const AnalysisIntentSchema = z.string().trim().min(1);

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
  leadProfilePatch: LeadProfilePatchSchema,
  intentSignalsPatch: IntentSignalsPatchSchema,
  interactionStatePatch: InteractionStatePatchSchema,
  nextQualificationStage: QualificationStageSchema,
  responseText: z.string(),
});

export type MessageAnalysis = z.infer<typeof MessageAnalysisSchema>;
