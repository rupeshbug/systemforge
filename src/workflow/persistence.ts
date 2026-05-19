import { and, desc, eq } from "drizzle-orm";
import { db } from "@/src/db";
import {
  leadMessages,
  leads,
  workflows,
  workflowEvents,
} from "@/src/db/schema";
import type { MessageAnalysis } from "@/src/workflow/analysis/schema";
import type { KnownLeadDetails } from "@/src/workflow/lead/contactDetails";
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

function serializePayload(payload: Record<string, unknown> | undefined) {
  return payload ? JSON.stringify(payload) : null;
}

function serializeResult(result: Record<string, unknown> | undefined) {
  return result ? JSON.stringify(result) : null;
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

  const [lead] = await db
    .insert(leads)
    .values({
      source: "website_chat",
      updatedAt: new Date(),
    })
    .returning({
      leadId: leads.id,
    });

  const [workflow] = await db
    .insert(workflows)
    .values({
      leadId: lead.leadId,
      currentStep: "message_received",
      status: "active",
      updatedAt: new Date(),
    })
    .returning({
      workflowId: workflows.id,
    });

  return {
    leadId: lead.leadId,
    workflowId: workflow.workflowId,
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
  const entries = Object.entries(details).filter(
    ([, value]) => typeof value === "string" && value.trim().length > 0,
  );

  if (entries.length === 0) {
    return;
  }

  await db
    .update(leads)
    .set({
      ...Object.fromEntries(entries),
      updatedAt: new Date(),
    })
    .where(eq(leads.id, leadId));
}

export async function getWorkflowContext(workflowId: string, leadId: string) {
  const [workflow] = await db
    .select({
      id: workflows.id,
      route: workflows.route,
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
