import { and, desc, eq } from "drizzle-orm";
import { db } from "@/src/db";
import {
  leadMessages,
  leads,
  workflows,
  workflowEvents,
} from "@/src/db/schema";
import { buildReviewOutcomeResponse } from "@/src/workflow/responses";
import type { MessageAnalysis } from "@/src/workflow/analysis/schema";
import type { KnownLeadDetails } from "@/src/workflow/lead/contactDetails";
import {
  DEFAULT_QUALIFICATION_STAGE,
  EMPTY_INTENT_SIGNALS,
  EMPTY_INTERACTION_STATE,
  EMPTY_LEAD_PROFILE,
  type InteractionState,
  InteractionStateSchema,
  type IntentSignals,
  IntentSignalsSchema,
  type LeadProfile,
  LeadProfileSchema,
  parseJsonWithSchema,
  type QualificationStage,
} from "@/src/workflow/memory";
import type { WorkflowStep } from "@/src/workflow/states";
import type {
  WorkflowEvent,
  WorkflowRoute,
} from "@/src/workflow/routing/types";

export class WorkflowSessionNotFoundError extends Error {
  constructor() {
    super("Workflow session not found.");
    this.name = "WorkflowSessionNotFoundError";
  }
}

type WorkflowSessionInput = {
  workflowId?: string;
  leadId?: string;
};

type SaveMessageInput = {
  leadId: string;
  workflowId: string;
  role: "user" | "assistant";
  message: string;
};

type UpdateWorkflowInput = {
  workflowId: string;
  route?: WorkflowRoute | null;
  currentStep: WorkflowStep;
  status: string;
  lastMessageId?: string;
  result?: Record<string, unknown>;
};

type LeadDetailsPatch = {
  name?: string;
  company?: string;
  email?: string;
  phone?: string;
};

type BatchQuery = Parameters<typeof db.batch>[0][number];

type PersistDeterministicTurnInput = {
  leadId: string;
  workflowId: string;
  userMessage: string;
  assistantMessage: string;
  route: WorkflowRoute;
  currentStep: WorkflowStep;
  status: string;
  leadDetails: LeadDetailsPatch;
  leadProfile: LeadProfile;
  intentSignals: IntentSignals;
  interactionState: InteractionState;
  qualificationStage: QualificationStage;
  events: WorkflowEvent[];
  result: Record<string, unknown>;
};

type PersistAiAnalysisStartInput = {
  leadId: string;
  workflowId: string;
  userMessage: string;
  route: WorkflowRoute;
  leadDetails: LeadDetailsPatch;
  leadProfile: LeadProfile;
  intentSignals: IntentSignals;
  interactionState: InteractionState;
  qualificationStage: QualificationStage;
  events: WorkflowEvent[];
  result: Record<string, unknown>;
};

type PersistAiAnalysisCompletionInput = {
  leadId: string;
  workflowId: string;
  assistantMessage: string;
  route: WorkflowRoute;
  currentStep: WorkflowStep;
  status: string;
  leadDetails: LeadDetailsPatch;
  leadProfile: LeadProfile;
  intentSignals: IntentSignals;
  interactionState: InteractionState;
  qualificationStage: QualificationStage;
  events: WorkflowEvent[];
  result: Record<string, unknown>;
};

type ReviewDecision = "approved" | "rejected";

type ResolveHumanReviewInput = {
  workflowId: string;
  decision: ReviewDecision;
  reviewerNote?: string;
};

type WorkflowSessionSnapshot = {
  workflowId: string;
  leadId: string;
  route: WorkflowRoute | null;
  currentStep: WorkflowStep;
  status: string;
  qualificationStage: QualificationStage;
  messages: Array<{
    id: string;
    role: "user" | "assistant";
    content: string;
    createdAt: Date;
  }>;
};

function serializePayload(payload: Record<string, unknown> | undefined) {
  return payload ? JSON.stringify(payload) : null;
}

function serializeResult(result: Record<string, unknown> | undefined) {
  return result ? JSON.stringify(result) : null;
}

function serializeMemoryState<T>(value: T) {
  return JSON.stringify(value);
}

function parseResultValue(result: string | null | undefined) {
  if (!result) {
    return null;
  }

  try {
    return JSON.parse(result) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function buildLeadUpdateValues(details: LeadDetailsPatch) {
  const entries = Object.entries(details).filter(
    ([, value]) => typeof value === "string" && value.trim().length > 0,
  );

  if (entries.length === 0) {
    return null;
  }

  return {
    ...Object.fromEntries(entries),
    updatedAt: new Date(),
  };
}

// first message should start a workflow, later messages should continue that workflow
export async function getOrCreateWorkflowSession({
  workflowId,
  leadId,
}: WorkflowSessionInput) {
  const hasSessionIdentifiers = Boolean(workflowId || leadId);

  if (workflowId && leadId) {
    const [existingWorkflow] = await db
      .select({
        workflowId: workflows.id,
        leadId: workflows.leadId,
      })
      .from(workflows)
      .where(and(eq(workflows.id, workflowId), eq(workflows.leadId, leadId)))
      .limit(1);

    if (existingWorkflow) {
      return existingWorkflow;
    }
  }

  if (hasSessionIdentifiers) {
    throw new WorkflowSessionNotFoundError();
  }

  const leadIdValue = crypto.randomUUID();
  const workflowIdValue = crypto.randomUUID();
  const now = new Date();

  await db.batch([
    db.insert(leads).values({
      id: leadIdValue,
      source: "website_chat",
      updatedAt: now,
    }),
    db.insert(workflows).values({
      id: workflowIdValue,
      leadId: leadIdValue,
      currentStep: "message_received",
      status: "active",
      qualificationStage: DEFAULT_QUALIFICATION_STAGE,
      leadProfile: serializeMemoryState(EMPTY_LEAD_PROFILE),
      intentSignals: serializeMemoryState(EMPTY_INTENT_SIGNALS),
      interactionState: serializeMemoryState(EMPTY_INTERACTION_STATE),
      updatedAt: now,
    }),
  ]);

  return {
    leadId: leadIdValue,
    workflowId: workflowIdValue,
  };
}

// save message in lead_messages table
export async function saveWorkflowMessage({
  leadId,
  workflowId,
  role,
  message,
}: SaveMessageInput) {
  const [savedMessage] = await db
    .insert(leadMessages)
    .values({
      leadId,
      workflowId,
      role,
      message,
    })
    .returning({
      id: leadMessages.id,
    });

  await db
    .update(workflows)
    .set({
      lastMessageId: savedMessage.id,
      updatedAt: new Date(),
    })
    .where(eq(workflows.id, workflowId));

  return savedMessage;
}

// preserve the workflow timeline. we want to know what the system did, not only what was said
export async function appendWorkflowEvents(
  workflowId: string,
  events: WorkflowEvent[],
) {
  if (events.length === 0) {
    return;
  }

  await db.insert(workflowEvents).values(
    events.map((event) => ({
      workflowId,
      eventType: event.type,
      step: event.step,
      payload: serializePayload(event.payload),
    })),
  );
}

export async function updateWorkflowState({
  workflowId,
  route,
  currentStep,
  status,
  lastMessageId,
  result,
}: UpdateWorkflowInput) {
  await db
    .update(workflows)
    .set({
      route: route ?? null,
      currentStep,
      status,
      lastMessageId,
      result: serializeResult(result),
      completedAt: status === "completed" ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(workflows.id, workflowId));
}

export async function updateLeadDetails(
  leadId: string,
  details: LeadDetailsPatch,
) {
  const values = buildLeadUpdateValues(details);

  if (!values) {
    return;
  }

  await db
    .update(leads)
    .set(values)
    .where(eq(leads.id, leadId));
}

export async function persistDeterministicWorkflowTurn({
  leadId,
  workflowId,
  userMessage,
  assistantMessage,
  route,
  currentStep,
  status,
  leadDetails,
  leadProfile,
  intentSignals,
  interactionState,
  qualificationStage,
  events,
  result,
}: PersistDeterministicTurnInput) {
  const userMessageId = crypto.randomUUID();
  const assistantMessageId = crypto.randomUUID();
  const leadUpdateValues = buildLeadUpdateValues(leadDetails);

  const queries: [BatchQuery, ...BatchQuery[]] = [
    db.insert(leadMessages).values({
      id: userMessageId,
      leadId,
      workflowId,
      role: "user",
      message: userMessage,
    }),
    ...(leadUpdateValues
      ? [
          db
            .update(leads)
            .set(leadUpdateValues)
            .where(eq(leads.id, leadId)),
        ]
      : []),
    ...(events.length > 0
      ? [
          db.insert(workflowEvents).values(
            events.map((event) => ({
              workflowId,
              eventType: event.type,
              step: event.step,
              payload: serializePayload(event.payload),
            })),
          ),
        ]
      : []),
    db.insert(leadMessages).values({
      id: assistantMessageId,
      leadId,
      workflowId,
      role: "assistant",
      message: assistantMessage,
    }),
    db
      .update(workflows)
      .set({
        route,
        qualificationStage,
        leadProfile: serializeMemoryState(leadProfile),
        intentSignals: serializeMemoryState(intentSignals),
        interactionState: serializeMemoryState(interactionState),
        currentStep,
        status,
        lastMessageId: assistantMessageId,
        result: serializeResult(result),
        completedAt: status === "completed" ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(workflows.id, workflowId)),
  ];

  await db.batch(queries);

  return {
    userMessageId,
    assistantMessageId,
  };
}

export async function persistAiAnalysisStart({
  leadId,
  workflowId,
  userMessage,
  route,
  leadDetails,
  leadProfile,
  intentSignals,
  interactionState,
  qualificationStage,
  events,
  result,
}: PersistAiAnalysisStartInput) {
  const userMessageId = crypto.randomUUID();
  const leadUpdateValues = buildLeadUpdateValues(leadDetails);

  const queries: [BatchQuery, ...BatchQuery[]] = [
    db.insert(leadMessages).values({
      id: userMessageId,
      leadId,
      workflowId,
      role: "user",
      message: userMessage,
    }),
    ...(leadUpdateValues
      ? [
          db
            .update(leads)
            .set(leadUpdateValues)
            .where(eq(leads.id, leadId)),
        ]
      : []),
    ...(events.length > 0
      ? [
          db.insert(workflowEvents).values(
            events.map((event) => ({
              workflowId,
              eventType: event.type,
              step: event.step,
              payload: serializePayload(event.payload),
            })),
          ),
        ]
      : []),
    db
      .update(workflows)
      .set({
        route,
        qualificationStage,
        leadProfile: serializeMemoryState(leadProfile),
        intentSignals: serializeMemoryState(intentSignals),
        interactionState: serializeMemoryState(interactionState),
        currentStep: "ai_analysis_running",
        status: "active",
        lastMessageId: userMessageId,
        result: serializeResult(result),
        completedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(workflows.id, workflowId)),
  ];

  await db.batch(queries);

  return {
    userMessageId,
  };
}

export async function persistAiAnalysisCompletion({
  leadId,
  workflowId,
  assistantMessage,
  route,
  currentStep,
  status,
  leadDetails,
  leadProfile,
  intentSignals,
  interactionState,
  qualificationStage,
  events,
  result,
}: PersistAiAnalysisCompletionInput) {
  const assistantMessageId = crypto.randomUUID();
  const leadUpdateValues = buildLeadUpdateValues(leadDetails);

  const queries: [BatchQuery, ...BatchQuery[]] = [
    db.insert(leadMessages).values({
      id: assistantMessageId,
      leadId,
      workflowId,
      role: "assistant",
      message: assistantMessage,
    }),
    ...(leadUpdateValues
      ? [
          db
            .update(leads)
            .set(leadUpdateValues)
            .where(eq(leads.id, leadId)),
        ]
      : []),
    ...(events.length > 0
      ? [
          db.insert(workflowEvents).values(
            events.map((event) => ({
              workflowId,
              eventType: event.type,
              step: event.step,
              payload: serializePayload(event.payload),
            })),
          ),
        ]
      : []),
    db
      .update(workflows)
      .set({
        route,
        qualificationStage,
        leadProfile: serializeMemoryState(leadProfile),
        intentSignals: serializeMemoryState(intentSignals),
        interactionState: serializeMemoryState(interactionState),
        currentStep,
        status,
        lastMessageId: assistantMessageId,
        result: serializeResult(result),
        completedAt: status === "completed" ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(workflows.id, workflowId)),
  ];

  await db.batch(queries);

  return {
    assistantMessageId,
  };
}

export async function getWorkflowContext(workflowId: string, leadId: string) {
  const [workflow] = await db
    .select({
      id: workflows.id,
      route: workflows.route,
      qualificationStage: workflows.qualificationStage,
      leadProfile: workflows.leadProfile,
      intentSignals: workflows.intentSignals,
      interactionState: workflows.interactionState,
      currentStep: workflows.currentStep,
      result: workflows.result,
    })
    .from(workflows)
    .where(and(eq(workflows.id, workflowId), eq(workflows.leadId, leadId)))
    .limit(1);

  const [lead] = await db
    .select({
      id: leads.id,
      name: leads.name,
      company: leads.company,
      email: leads.email,
      phone: leads.phone,
    })
    .from(leads)
    .where(eq(leads.id, leadId))
    .limit(1);

  const recentMessages = await db
    .select({
      role: leadMessages.role,
      content: leadMessages.message,
      createdAt: leadMessages.createdAt,
    })
    .from(leadMessages)
    .where(eq(leadMessages.workflowId, workflowId))
    .orderBy(desc(leadMessages.createdAt))
    .limit(8);

  return {
    workflow: workflow
      ? {
          id: workflow.id,
          route: workflow.route as WorkflowRoute | null,
          qualificationStage:
            (workflow.qualificationStage as QualificationStage | null) ??
            DEFAULT_QUALIFICATION_STAGE,
          leadProfile: parseJsonWithSchema(
            workflow.leadProfile,
            LeadProfileSchema,
            EMPTY_LEAD_PROFILE,
          ),
          intentSignals: parseJsonWithSchema(
            workflow.intentSignals,
            IntentSignalsSchema,
            EMPTY_INTENT_SIGNALS,
          ),
          interactionState: parseJsonWithSchema(
            workflow.interactionState,
            InteractionStateSchema,
            EMPTY_INTERACTION_STATE,
          ),
          currentStep: workflow.currentStep as WorkflowStep,
          result: workflow.result ? JSON.parse(workflow.result) : null,
        }
      : null,
    lead: lead
      ? {
          id: lead.id,
          name: lead.name,
          businessName: lead.company,
          email: lead.email,
          phone: lead.phone,
        }
      : null,
    recentMessages: recentMessages.reverse().map((message) => ({
      role: message.role as "user" | "assistant",
      content: message.content,
    })),
  };
}

export async function listHumanReviewWorkflows() {
  const rows = await db
    .select({
      workflowId: workflows.id,
      leadId: workflows.leadId,
      route: workflows.route,
      qualificationStage: workflows.qualificationStage,
      status: workflows.status,
      currentStep: workflows.currentStep,
      updatedAt: workflows.updatedAt,
      result: workflows.result,
      leadName: leads.name,
      leadEmail: leads.email,
      leadPhone: leads.phone,
      leadCompany: leads.company,
    })
    .from(workflows)
    .innerJoin(leads, eq(workflows.leadId, leads.id))
    .where(eq(workflows.status, "waiting_for_human_review"))
    .orderBy(desc(workflows.updatedAt));

  return rows.map((row) => ({
    workflowId: row.workflowId,
    leadId: row.leadId,
    route: row.route as WorkflowRoute | null,
    qualificationStage:
      (row.qualificationStage as QualificationStage | null) ??
      DEFAULT_QUALIFICATION_STAGE,
    status: row.status,
    currentStep: row.currentStep as WorkflowStep,
    updatedAt: row.updatedAt,
    result: parseResultValue(row.result),
    lead: {
      name: row.leadName,
      email: row.leadEmail,
      phone: row.leadPhone,
      businessName: row.leadCompany,
    },
  }));
}

export async function getHumanReviewWorkflow(workflowId: string) {
  const [workflow] = await db
    .select({
      workflowId: workflows.id,
      leadId: workflows.leadId,
      route: workflows.route,
      qualificationStage: workflows.qualificationStage,
      status: workflows.status,
      currentStep: workflows.currentStep,
      updatedAt: workflows.updatedAt,
      startedAt: workflows.startedAt,
      result: workflows.result,
      leadName: leads.name,
      leadEmail: leads.email,
      leadPhone: leads.phone,
      leadCompany: leads.company,
    })
    .from(workflows)
    .innerJoin(leads, eq(workflows.leadId, leads.id))
    .where(eq(workflows.id, workflowId))
    .limit(1);

  if (!workflow) {
    return null;
  }

  const recentMessages = await db
    .select({
      id: leadMessages.id,
      role: leadMessages.role,
      content: leadMessages.message,
      createdAt: leadMessages.createdAt,
    })
    .from(leadMessages)
    .where(eq(leadMessages.workflowId, workflowId))
    .orderBy(desc(leadMessages.createdAt))
    .limit(24);

  const events = await db
    .select({
      id: workflowEvents.id,
      eventType: workflowEvents.eventType,
      step: workflowEvents.step,
      payload: workflowEvents.payload,
      createdAt: workflowEvents.createdAt,
    })
    .from(workflowEvents)
    .where(eq(workflowEvents.workflowId, workflowId))
    .orderBy(desc(workflowEvents.createdAt))
    .limit(40);

  const context = await getWorkflowContext(workflowId, workflow.leadId);

  return {
    workflow: {
      id: workflow.workflowId,
      leadId: workflow.leadId,
      route: workflow.route as WorkflowRoute | null,
      qualificationStage:
        (workflow.qualificationStage as QualificationStage | null) ??
        DEFAULT_QUALIFICATION_STAGE,
      status: workflow.status,
      currentStep: workflow.currentStep as WorkflowStep,
      updatedAt: workflow.updatedAt,
      startedAt: workflow.startedAt,
      result: parseResultValue(workflow.result),
    },
    lead: {
      name: workflow.leadName,
      email: workflow.leadEmail,
      phone: workflow.leadPhone,
      businessName: workflow.leadCompany,
    },
    memory: {
      leadProfile: context.workflow?.leadProfile ?? EMPTY_LEAD_PROFILE,
      intentSignals: context.workflow?.intentSignals ?? EMPTY_INTENT_SIGNALS,
      interactionState:
        context.workflow?.interactionState ?? EMPTY_INTERACTION_STATE,
    },
    messages: recentMessages.reverse().map((message) => ({
      id: message.id,
      role: message.role as "user" | "assistant",
      content: message.content,
      createdAt: message.createdAt,
    })),
    events: events.reverse().map((event) => ({
      id: event.id,
      eventType: event.eventType,
      step: event.step,
      payload: parseResultValue(event.payload),
      createdAt: event.createdAt,
    })),
  };
}

export async function getWorkflowSessionSnapshot(
  workflowId: string,
  leadId: string,
): Promise<WorkflowSessionSnapshot | null> {
  const [workflow] = await db
    .select({
      workflowId: workflows.id,
      leadId: workflows.leadId,
      route: workflows.route,
      currentStep: workflows.currentStep,
      status: workflows.status,
      qualificationStage: workflows.qualificationStage,
    })
    .from(workflows)
    .where(and(eq(workflows.id, workflowId), eq(workflows.leadId, leadId)))
    .limit(1);

  if (!workflow) {
    return null;
  }

  const messages = await db
    .select({
      id: leadMessages.id,
      role: leadMessages.role,
      content: leadMessages.message,
      createdAt: leadMessages.createdAt,
    })
    .from(leadMessages)
    .where(eq(leadMessages.workflowId, workflowId))
    .orderBy(leadMessages.createdAt);

  return {
    workflowId: workflow.workflowId,
    leadId: workflow.leadId,
    route: workflow.route as WorkflowRoute | null,
    currentStep: workflow.currentStep as WorkflowStep,
    status: workflow.status,
    qualificationStage:
      (workflow.qualificationStage as QualificationStage | null) ??
      DEFAULT_QUALIFICATION_STAGE,
    messages: messages.map((message) => ({
      id: message.id,
      role: message.role as "user" | "assistant",
      content: message.content,
      createdAt: message.createdAt,
    })),
  };
}

export async function resolveHumanReview({
  workflowId,
  decision,
  reviewerNote,
}: ResolveHumanReviewInput) {
  const [workflow] = await db
    .select({
      id: workflows.id,
      route: workflows.route,
      result: workflows.result,
      leadId: workflows.leadId,
      leadProfile: workflows.leadProfile,
      intentSignals: workflows.intentSignals,
      interactionState: workflows.interactionState,
      qualificationStage: workflows.qualificationStage,
    })
    .from(workflows)
    .where(eq(workflows.id, workflowId))
    .limit(1);

  if (!workflow) {
    return null;
  }

  const assistantMessageId = crypto.randomUUID();
  const eventType = decision === "approved" ? "HUMAN_APPROVED" : "HUMAN_REJECTED";
  const assistantMessage =
    buildReviewOutcomeResponse(
      decision,
      workflow.route as WorkflowRoute | null,
    );
  const existingResult = parseResultValue(workflow.result) ?? {};
  const reviewResult = {
    ...existingResult,
    review: {
      decision,
      reviewerNote: reviewerNote?.trim() || null,
      reviewedAt: new Date().toISOString(),
    },
  };

  const queries: [BatchQuery, ...BatchQuery[]] = [
    db.insert(leadMessages).values({
      id: assistantMessageId,
      leadId: workflow.leadId,
      workflowId,
      role: "assistant",
      message: assistantMessage,
    }),
    db.insert(workflowEvents).values([
      {
        workflowId,
        eventType,
        step: "completed",
        payload: serializePayload({
          reviewerNote: reviewerNote?.trim() || null,
        }),
      },
      {
        workflowId,
        eventType: "WORKFLOW_COMPLETED",
        step: "completed",
        payload: serializePayload({ decision }),
      },
    ]),
    db
      .update(workflows)
      .set({
        status: decision === "approved" ? "completed" : "rejected",
        currentStep: "completed",
        lastMessageId: assistantMessageId,
        result: serializeResult(reviewResult),
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(workflows.id, workflowId)),
  ];

  await db.batch(queries);

  return {
    workflowId: workflow.id,
    leadId: workflow.leadId,
    decision,
  };
}

export function getLeadDetailsFromAnalysis(
  analysis: MessageAnalysis,
): LeadDetailsPatch {
  return {
    name: analysis.extractedContact.name ?? undefined,
    company: analysis.extractedContact.businessName ?? undefined,
    email: analysis.extractedContact.email ?? undefined,
    phone: analysis.extractedContact.phone ?? undefined,
  };
}

export function getLeadDetailsPatch(
  lead: Partial<KnownLeadDetails>,
): LeadDetailsPatch {
  return {
    name: lead.name ?? undefined,
    company: lead.businessName ?? undefined,
    email: lead.email ?? undefined,
    phone: lead.phone ?? undefined,
  };
}
