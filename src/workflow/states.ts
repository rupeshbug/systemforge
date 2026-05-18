export const WORKFLOW_STEPS = [
  "message_received",
  "deterministic_routing",
  "route_resolved",
  "ai_analysis_required",
  "ai_analysis_running",
  "waiting_for_human_review",
  "completed",
] as const;

export type WorkflowStep = (typeof WORKFLOW_STEPS)[number];
