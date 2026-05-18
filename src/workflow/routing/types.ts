import type { WorkflowEventType } from "@/src/workflow/events";
import type { WorkflowStep } from "@/src/workflow/states";

export const DETERMINISTIC_ROUTES = [
  "greeting",
  "pricing",
  "demo_request",
  "human_contact",
  "onboarding",
  "irrelevant",
  "needs_ai_analysis",
] as const;

export type DeterministicRoute = (typeof DETERMINISTIC_ROUTES)[number];

export type MatchType = "keyword" | "phrase" | "fallback";

export type WorkflowEvent = {
  type: WorkflowEventType;
  step: WorkflowStep;
  payload?: Record<string, string | boolean | number | null>;
};

export type DeterministicRoutingResult = {
  route: DeterministicRoute;
  matched: boolean;
  matchedBy: MatchType;
  currentStep: WorkflowStep;
  responseText?: string;
  events: WorkflowEvent[];
};
