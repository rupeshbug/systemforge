import { z } from "zod";
import { analyzeMessage } from "@/src/workflow/analysis/analyzeMessage";
import type { MessageAnalysis } from "@/src/workflow/analysis/schema";
import {
  extractLeadDetailsFromMessage,
  mergeLeadDetails,
} from "@/src/workflow/lead/contactDetails";
import {
  appendWorkflowEvents,
  getLeadDetailsFromAnalysis,
  getLeadDetailsPatch,
  getOrCreateWorkflowSession,
  getWorkflowContext,
  saveWorkflowMessage,
  updateLeadDetails,
  updateWorkflowState,
  WorkflowSessionNotFoundError,
} from "@/src/workflow/persistence";
import { buildRouteResponse } from "@/src/workflow/responses";
import { routeDeterministically } from "@/src/workflow/routing/deterministic";
import type { WorkflowEvent } from "@/src/workflow/routing/types";

const ChatRequestSchema = z.object({
  prompt: z.string().trim().min(1),
  workflowId: z.string().uuid().optional(),
  leadId: z.string().uuid().optional(),
});

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json(
      {
        ok: false,
        error: "Request body must be valid JSON.",
      },
      { status: 400 },
    );
  }

  const parsedBody = ChatRequestSchema.safeParse(body);

  if (!parsedBody.success) {
    return Response.json(
      {
        ok: false,
        error: "Prompt is required.",
      },
      { status: 400 },
    );
  }

  const { prompt, workflowId, leadId } = parsedBody.data;
  let session;

  try {
    session = await getOrCreateWorkflowSession({ workflowId, leadId });
  } catch (error) {
    if (error instanceof WorkflowSessionNotFoundError) {
      return Response.json(
        {
          ok: false,
          error:
            "The saved workflow session could not be resumed. Please start a new conversation.",
          code: "workflow_session_not_found",
        },
        { status: 409 },
      );
    }

    throw error;
  }

  const savedUserMessage = await saveWorkflowMessage({
    leadId: session.leadId,
    workflowId: session.workflowId,
    role: "user",
    message: prompt,
  });

  const initialContext = await getWorkflowContext(session.workflowId, session.leadId);
  const extractedLeadDetails = extractLeadDetailsFromMessage(prompt);
  const mergedLeadDetails = mergeLeadDetails(
    initialContext.lead ?? null,
    extractedLeadDetails,
  );

  await updateLeadDetails(
    session.leadId,
    getLeadDetailsPatch(mergedLeadDetails),
  );

  const workflowEvents: WorkflowEvent[] = [
    {
      type: "MESSAGE_RECEIVED",
      step: "message_received",
      payload: { promptLength: prompt.length },
    },
  ];

  const deterministicResult = routeDeterministically(prompt);
  workflowEvents.push(...deterministicResult.events);
  await appendWorkflowEvents(session.workflowId, workflowEvents);

  if (deterministicResult.matched && deterministicResult.route !== "needs_ai_analysis") {
    const responseText = buildRouteResponse(
      deterministicResult.route,
      mergedLeadDetails,
    );
    const assistantMessage = await saveWorkflowMessage({
      leadId: session.leadId,
      workflowId: session.workflowId,
      role: "assistant",
      message: responseText ?? "",
    });

    await updateWorkflowState({
      workflowId: session.workflowId,
      route: deterministicResult.route,
      currentStep: deterministicResult.currentStep,
      status: "active",
      lastMessageId: assistantMessage.id,
      result: {
        source: "deterministic",
        responseText,
      },
    });

    return Response.json({
      ok: true,
      leadId: session.leadId,
      workflowId: session.workflowId,
      prompt,
      text: responseText,
      route: deterministicResult.route,
      currentStep: deterministicResult.currentStep,
      events: workflowEvents,
    });
  }

  const aiStartEvents: WorkflowEvent[] = [
    {
      type: "AI_ANALYSIS_STARTED",
      step: "ai_analysis_running",
      payload: { route: deterministicResult.route },
    },
  ];

  await appendWorkflowEvents(session.workflowId, aiStartEvents);
  await updateWorkflowState({
    workflowId: session.workflowId,
    route: deterministicResult.route,
    currentStep: "ai_analysis_running",
    status: "active",
    lastMessageId: savedUserMessage.id,
    result: {
      source: "deterministic",
      fallbackReason: "no_deterministic_match",
    },
  });

  const context = await getWorkflowContext(session.workflowId, session.leadId);

  let analysis: MessageAnalysis;

  try {
    analysis = await analyzeMessage({
      userMessage: prompt,
      recentMessages: context.recentMessages,
      knownLead: mergedLeadDetails,
      workflow: {
        route: context.workflow?.route ?? deterministicResult.route,
        currentStep: context.workflow?.currentStep ?? "ai_analysis_running",
      },
    });
  } catch (error) {
    const failureEvents: WorkflowEvent[] = [
      {
        type: "AI_ANALYSIS_FAILED",
        step: "ai_analysis_running",
        payload: {
          message:
            error instanceof Error ? error.message : "Unknown AI analysis error",
        },
      },
    ];

    await appendWorkflowEvents(session.workflowId, failureEvents);

    return Response.json(
      {
        ok: false,
        error: "Unable to analyze the message right now.",
      },
      { status: 500 },
    );
  }

  const resolvedLeadDetails = mergeLeadDetails(
    mergedLeadDetails,
    {
      name: analysis.extractedContact.name,
      businessName: analysis.extractedContact.businessName,
      email: analysis.extractedContact.email,
      phone: analysis.extractedContact.phone,
    },
  );

  await updateLeadDetails(
    session.leadId,
    getLeadDetailsFromAnalysis(analysis),
  );

  const responseText =
    analysis.route === "clarification_required"
      ? buildRouteResponse(
          analysis.route,
          resolvedLeadDetails,
          analysis.responseText,
        )
      : buildRouteResponse(analysis.route, resolvedLeadDetails);

  const assistantMessage = await saveWorkflowMessage({
    leadId: session.leadId,
    workflowId: session.workflowId,
    role: "assistant",
    message: responseText ?? analysis.responseText,
  });

  const currentStep = analysis.requiresHumanReview
    ? "waiting_for_human_review"
    : "route_resolved";
  const status = analysis.requiresHumanReview
    ? "waiting_for_human_review"
    : "active";

  const analysisEvents: WorkflowEvent[] = [
    {
      type: "AI_ANALYSIS_COMPLETED",
      step: currentStep,
      payload: {
        route: analysis.route,
        confidence: analysis.confidence,
        requiresHumanReview: analysis.requiresHumanReview,
      },
    },
    {
      type: "AI_RESPONSE_GENERATED",
      step: currentStep,
      payload: { route: analysis.route },
    },
  ];

  if (analysis.requiresHumanReview) {
    analysisEvents.push({
      type: "HUMAN_REVIEW_REQUIRED",
      step: "waiting_for_human_review",
      payload: { route: analysis.route },
    });
  }

  await appendWorkflowEvents(session.workflowId, analysisEvents);
  await updateWorkflowState({
    workflowId: session.workflowId,
    route: analysis.route,
    currentStep,
    status,
    lastMessageId: assistantMessage.id,
    result: {
      source: "ai_analysis",
      analysis,
    },
  });

  return Response.json({
    ok: true,
    leadId: session.leadId,
    workflowId: session.workflowId,
    prompt,
    text: responseText ?? analysis.responseText,
    route: analysis.route,
    currentStep,
    events: [...workflowEvents, ...aiStartEvents, ...analysisEvents],
  });
}
