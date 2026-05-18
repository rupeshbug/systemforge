import type { WorkflowEventType } from "@/src/workflow/events";
import type { WorkflowStep } from "@/src/workflow/states";

type JsonValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: JsonValue }
  | JsonValue[];

export const WORKFLOW_ROUTES = [
  "greeting",
  "pricing",
  "demo_request",
  "human_contact",
  "onboarding",
  "irrelevant",
  "clarification_required",
  "needs_ai_analysis",
] as const;

export type WorkflowRoute = (typeof WORKFLOW_ROUTES)[number];

export type DeterministicRoute = Exclude<
  WorkflowRoute,
  "clarification_required"
>;

export type MatchType = "keyword" | "phrase" | "fallback";

export type WorkflowEvent = {
  type: WorkflowEventType;
  step: WorkflowStep;
  payload?: Record<string, JsonValue>;
};

export type DeterministicRoutingResult = {
  route: DeterministicRoute;
  matched: boolean;
  matchedBy: MatchType;
  currentStep: WorkflowStep;
  responseText?: string;
  events: WorkflowEvent[];
};
