import { z } from "zod";
import type { KnownLeadDetails } from "@/src/workflow/lead/contactDetails";
import { getMissingContactFields } from "@/src/workflow/lead/contactDetails";
import type { WorkflowRoute } from "@/src/workflow/routing/types";

export const ContactFieldSchema = z.enum([
  "name",
  "businessName",
  "email",
  "phone",
]);

export type ContactField = z.infer<typeof ContactFieldSchema>;

export const QualificationFieldSchema = z.enum([
  "goal",
  "useCase",
  "timeline",
  "budget",
  "teamSize",
]);

export type QualificationField = z.infer<typeof QualificationFieldSchema>;

export const QualificationStageSchema = z.enum([
  "collecting_information",
  "qualifying",
  "ready_to_handoff",
  "disqualified",
]);

export type QualificationStage = z.infer<typeof QualificationStageSchema>;

export const LeadProfileSchema = z.object({
  goal: z.string().nullable(),
  useCase: z.string().nullable(),
  timeline: z.string().nullable(),
  budget: z.string().nullable(),
  teamSize: z.string().nullable(),
});

export type LeadProfile = z.infer<typeof LeadProfileSchema>;

export const IntentSignalsSchema = z.object({
  wantsPricing: z.boolean(),
  wantsDemo: z.boolean(),
  wantsHumanContact: z.boolean(),
  wantsOnboarding: z.boolean(),
});

export type IntentSignals = z.infer<typeof IntentSignalsSchema>;

export const InteractionStateSchema = z.object({
  hasAskedForContactDetails: z.boolean(),
  missingContactFields: z.array(ContactFieldSchema),
  hasAskedForQualificationDetails: z.boolean(),
  missingQualificationFields: z.array(QualificationFieldSchema),
});

export type InteractionState = z.infer<typeof InteractionStateSchema>;

export const LeadProfilePatchSchema = z.object({
  goal: z.string().nullable(),
  useCase: z.string().nullable(),
  timeline: z.string().nullable(),
  budget: z.string().nullable(),
  teamSize: z.string().nullable(),
});

export type LeadProfilePatch = z.infer<typeof LeadProfilePatchSchema>;

export const IntentSignalsPatchSchema = z.object({
  wantsPricing: z.boolean().nullable(),
  wantsDemo: z.boolean().nullable(),
  wantsHumanContact: z.boolean().nullable(),
  wantsOnboarding: z.boolean().nullable(),
});

export type IntentSignalsPatch = z.infer<typeof IntentSignalsPatchSchema>;

export const InteractionStatePatchSchema = z.object({
  hasAskedForQualificationDetails: z.boolean().nullable(),
  missingQualificationFields: z.array(QualificationFieldSchema).nullable(),
});

export type InteractionStatePatch = z.infer<typeof InteractionStatePatchSchema>;

export type WorkflowMemory = {
  qualificationStage: QualificationStage;
  leadProfile: LeadProfile;
  intentSignals: IntentSignals;
  interactionState: InteractionState;
};

export const EMPTY_LEAD_PROFILE: LeadProfile = {
  goal: null,
  useCase: null,
  timeline: null,
  budget: null,
  teamSize: null,
};

export const EMPTY_INTENT_SIGNALS: IntentSignals = {
  wantsPricing: false,
  wantsDemo: false,
  wantsHumanContact: false,
  wantsOnboarding: false,
};

export const EMPTY_INTERACTION_STATE: InteractionState = {
  hasAskedForContactDetails: false,
  missingContactFields: [],
  hasAskedForQualificationDetails: false,
  missingQualificationFields: [],
};

export const DEFAULT_QUALIFICATION_STAGE: QualificationStage =
  "collecting_information";

export function getMissingQualificationFields(
  profile: LeadProfile | null | undefined,
): QualificationField[] {
  const current = profile ?? EMPTY_LEAD_PROFILE;
  const missing: QualificationField[] = [];

  if (!current.useCase?.trim()) {
    missing.push("useCase");
  }

  if (!current.timeline?.trim()) {
    missing.push("timeline");
  }

  if (!current.budget?.trim()) {
    missing.push("budget");
  }

  if (!current.teamSize?.trim()) {
    missing.push("teamSize");
  }

  return missing;
}

export function mergeLeadProfile(
  base: LeadProfile | null | undefined,
  patch: LeadProfilePatch | null | undefined,
): LeadProfile {
  const existing = base ?? EMPTY_LEAD_PROFILE;

  return {
    goal: sanitizeValue(patch?.goal) ?? existing.goal,
    useCase: sanitizeValue(patch?.useCase) ?? existing.useCase,
    timeline: sanitizeValue(patch?.timeline) ?? existing.timeline,
    budget: sanitizeValue(patch?.budget) ?? existing.budget,
    teamSize: sanitizeValue(patch?.teamSize) ?? existing.teamSize,
  };
}

export function mergeIntentSignals(
  base: IntentSignals | null | undefined,
  patch: IntentSignalsPatch | null | undefined,
): IntentSignals {
  const existing = base ?? EMPTY_INTENT_SIGNALS;

  return {
    wantsPricing: existing.wantsPricing || patch?.wantsPricing === true,
    wantsDemo: existing.wantsDemo || patch?.wantsDemo === true,
    wantsHumanContact:
      existing.wantsHumanContact || patch?.wantsHumanContact === true,
    wantsOnboarding:
      existing.wantsOnboarding || patch?.wantsOnboarding === true,
  };
}

export function mergeInteractionState(
  base: InteractionState | null | undefined,
  patch: InteractionStatePatch | null | undefined,
  runtimeState?: Partial<InteractionState>,
): InteractionState {
  const existing = base ?? EMPTY_INTERACTION_STATE;

  return {
    hasAskedForContactDetails:
      runtimeState?.hasAskedForContactDetails ??
      existing.hasAskedForContactDetails,
    missingContactFields:
      runtimeState?.missingContactFields ?? existing.missingContactFields,
    hasAskedForQualificationDetails:
      runtimeState?.hasAskedForQualificationDetails ??
      patch?.hasAskedForQualificationDetails ??
      existing.hasAskedForQualificationDetails,
    missingQualificationFields:
      runtimeState?.missingQualificationFields ??
      patch?.missingQualificationFields ??
      existing.missingQualificationFields,
  };
}

export function deriveIntentSignalsFromRoute(
  route: WorkflowRoute,
): IntentSignalsPatch {
  return {
    wantsPricing: route === "pricing",
    wantsDemo: route === "demo_request",
    wantsHumanContact: route === "human_contact",
    wantsOnboarding: route === "onboarding",
  };
}

export function deriveQualificationStage(
  route: WorkflowRoute,
  knownLead: KnownLeadDetails | null | undefined,
  currentStage: QualificationStage | null | undefined,
  requiresHumanReview = false,
): QualificationStage {
  if (requiresHumanReview) {
    return "ready_to_handoff";
  }

  const missingContactFields = getMissingContactFields(knownLead);

  if (route === "clarification_required" || missingContactFields.length > 0) {
    return "collecting_information";
  }

  if (
    route === "pricing" ||
    route === "demo_request" ||
    route === "human_contact" ||
    route === "onboarding"
  ) {
    return "qualifying";
  }

  return currentStage ?? DEFAULT_QUALIFICATION_STAGE;
}

export function computeInteractionStateFromRoute({
  route,
  lead,
  leadProfile,
  previousState,
  qualificationPatch,
  hasAskedForQualificationDetails,
}: {
  route: WorkflowRoute;
  lead: KnownLeadDetails | null | undefined;
  leadProfile?: LeadProfile | null;
  previousState?: InteractionState | null;
  qualificationPatch?: InteractionStatePatch | null;
  hasAskedForQualificationDetails?: boolean;
}) {
  const missingContactFields = getMissingContactFields(lead);
  const shouldAskForContactDetails =
    isBusinessRelevantRoute(route) && missingContactFields.length > 0;
  const missingQualificationFields = getMissingQualificationFields(leadProfile);
  const shouldAskForQualificationDetails =
    hasAskedForQualificationDetails ??
    qualificationPatch?.hasAskedForQualificationDetails ??
    previousState?.hasAskedForQualificationDetails ??
    false;

  return mergeInteractionState(previousState, qualificationPatch, {
    hasAskedForContactDetails:
      previousState?.hasAskedForContactDetails === true ||
      shouldAskForContactDetails,
    missingContactFields,
    hasAskedForQualificationDetails: shouldAskForQualificationDetails,
    missingQualificationFields,
  });
}

export function parseJsonWithSchema<T>(
  value: string | null | undefined,
  schema: z.ZodType<T>,
  fallback: T,
) {
  if (!value) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(value);
    return schema.parse(parsed);
  } catch {
    return fallback;
  }
}

function isBusinessRelevantRoute(route: WorkflowRoute) {
  return (
    route === "pricing" ||
    route === "demo_request" ||
    route === "human_contact" ||
    route === "onboarding" ||
    route === "clarification_required"
  );
}

function sanitizeValue(value: string | null | undefined) {
  if (typeof value !== "string") {
    return value ?? null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
