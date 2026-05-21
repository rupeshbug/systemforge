import { z } from "zod";
import { analyzeMessage } from "@/src/workflow/analysis/analyzeMessage";
import type { MessageAnalysis } from "@/src/workflow/analysis/schema";
import {
  extractLeadDetailsFromMessage,
  mergeLeadDetails,
} from "@/src/workflow/lead/contactDetails";
import {
  computeInteractionStateFromRoute,
  deriveIntentSignalsFromRoute,
  deriveQualificationStage,
  mergeIntentSignals,
  mergeLeadProfile,
} from "@/src/workflow/memory";
import {
  appendWorkflowEvents,
  getLeadDetailsFromAnalysis,
  getLeadDetailsPatch,
  getOrCreateWorkflowSession,
  getWorkflowContext,
  persistAiAnalysisCompletion,
  persistAiAnalysisStart,
  persistDeterministicWorkflowTurn,
  WorkflowSessionNotFoundError,
} from "@/src/workflow/persistence";
import {
  buildContactCompletionResponse,
  buildContactConfirmationResponse,
  buildPendingReviewResponse,
  buildRouteResponse,
} from "@/src/workflow/responses";
import { routeDeterministically } from "@/src/workflow/routing/deterministic";
import type { WorkflowEvent } from "@/src/workflow/routing/types";
import { getMissingContactFields } from "@/src/workflow/lead/contactDetails";

const ChatRequestSchema = z.object({
  prompt: z.string().trim().min(1),
  workflowId: z.string().uuid().optional(),
  leadId: z.string().uuid().optional(),
});

function logWorkflowDebug(
  stage: string,
  details: Record<string, unknown>,
) {
  if (process.env.WORKFLOW_DEBUG !== "true") {
    return;
  }

  console.log(`[WorkflowDebug] ${stage}`, details);
}

function isContactConfirmationPrompt(message: string) {
  const normalized = message.toLowerCase().replace(/[^\w\s]/g, " ").trim();

  const asksIfKnown =
    (normalized.includes("do you have") ||
      normalized.includes("you have my") ||
      normalized.includes("have my") ||
      normalized.includes("have that info")) &&
    (normalized.includes("email") ||
      normalized.includes("mail") ||
      normalized.includes("number") ||
      normalized.includes("phone") ||
      normalized.includes("contact") ||
      normalized.includes("info"));

  const repeatsSharedInfo =
    (normalized.includes("i gave you") || normalized.includes("i shared")) &&
    (normalized.includes("name") ||
      normalized.includes("email") ||
      normalized.includes("number") ||
      normalized.includes("phone") ||
      normalized.includes("contact") ||
      normalized.includes("info"));

  return asksIfKnown || repeatsSharedInfo;
}

function responseAsksForQualification(responseText: string | null | undefined) {
  if (!responseText) {
    return false;
  }

  const normalized = responseText.toLowerCase();

  return (
    normalized.includes("use case") ||
    normalized.includes("budget") ||
    normalized.includes("timeline") ||
    normalized.includes("team size") ||
    normalized.includes("how many people")
  );
}

function extractUseCaseFromReply(
  latestUserMessage: string,
  recentMessages: { role: "user" | "assistant"; content: string }[],
) {
  const lastAssistantMessage = [...recentMessages]
    .reverse()
    .find((message) => message.role === "assistant");

  if (!lastAssistantMessage) {
    return null;
  }

  const lastAssistantText = lastAssistantMessage.content.toLowerCase();

  if (!lastAssistantText.includes("use case")) {
    return null;
  }

  const trimmed = latestUserMessage.trim();

  if (trimmed.length < 12) {
    return null;
  }

  return trimmed;
}

function extractBudgetFromReply(
  latestUserMessage: string,
  recentMessages: { role: "user" | "assistant"; content: string }[],
) {
  const lastAssistantMessage = [...recentMessages]
    .reverse()
    .find((message) => message.role === "assistant");

  if (!lastAssistantMessage) {
    return null;
  }

  const lastAssistantText = lastAssistantMessage.content.toLowerCase();

  if (!lastAssistantText.includes("budget")) {
    return null;
  }

  const normalized = latestUserMessage.trim().toLowerCase();

  if (
    normalized === "no" ||
    normalized === "nope" ||
    normalized === "not yet" ||
    normalized === "not sure" ||
    normalized === "don't know" ||
    normalized === "dont know" ||
    normalized === "no budget" ||
    normalized === "no budget yet" ||
    normalized === "we do not have one yet" ||
    normalized === "we don't have one yet"
  ) {
    return "not specified yet";
  }

  return null;
}

function isHumanReviewCandidateRoute(route: string | null | undefined) {
  return route === "human_contact" || route === "demo_request";
}

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

  logWorkflowDebug("session_ready", {
    workflowId: session.workflowId,
    leadId: session.leadId,
    resumedSession: Boolean(workflowId && leadId),
  });

  const initialContext = await getWorkflowContext(
    session.workflowId,
    session.leadId,
  );
  const extractedLeadDetails = extractLeadDetailsFromMessage(prompt);
  const mergedLeadDetails = mergeLeadDetails(
    initialContext.lead ?? null,
    extractedLeadDetails,
  );
  const currentMemory = {
    qualificationStage:
      initialContext.workflow?.qualificationStage ?? "collecting_information",
    leadProfile: initialContext.workflow?.leadProfile ?? {
      goal: null,
      useCase: null,
      timeline: null,
      budget: null,
      teamSize: null,
    },
    intentSignals: initialContext.workflow?.intentSignals ?? {
      wantsPricing: false,
      wantsDemo: false,
      wantsHumanContact: false,
      wantsOnboarding: false,
    },
    interactionState: initialContext.workflow?.interactionState ?? {
      hasAskedForContactDetails: false,
      missingContactFields: [],
      hasAskedForQualificationDetails: false,
      missingQualificationFields: [],
    },
  };

  logWorkflowDebug("lead_details_resolved", {
    workflowId: session.workflowId,
    extractedLeadDetails,
    mergedLeadDetails,
    recentMessageCount: initialContext.recentMessages.length,
    currentMemory,
  });

  const currentRoute = initialContext.workflow?.route ?? null;
  const contactCompletionResponse = buildContactCompletionResponse(
    currentRoute,
    initialContext.lead ?? null,
    mergedLeadDetails,
    currentMemory.leadProfile,
  );
  const contactConfirmationResponse = isContactConfirmationPrompt(prompt)
    ? buildContactConfirmationResponse(currentRoute, mergedLeadDetails)
    : null;

  if (contactCompletionResponse || contactConfirmationResponse) {
    const responseRoute = currentRoute ?? "clarification_required";
    const shouldEnterHumanReview =
      responseRoute !== "clarification_required" &&
      isHumanReviewCandidateRoute(responseRoute) &&
      getMissingContactFields(mergedLeadDetails).length === 0;
    const responseText = shouldEnterHumanReview
      ? buildPendingReviewResponse(responseRoute, mergedLeadDetails)
      : contactCompletionResponse ?? contactConfirmationResponse ?? "";
    const nextIntentSignals = mergeIntentSignals(
      currentMemory.intentSignals,
      currentRoute ? deriveIntentSignalsFromRoute(currentRoute) : null,
    );
    const nextInteractionState = computeInteractionStateFromRoute({
      route: responseRoute,
      lead: mergedLeadDetails,
      leadProfile: currentMemory.leadProfile,
      previousState: currentMemory.interactionState,
      hasAskedForQualificationDetails:
        currentMemory.interactionState.hasAskedForQualificationDetails ||
        responseAsksForQualification(responseText),
    });
    const nextQualificationStage = deriveQualificationStage(
      responseRoute,
      mergedLeadDetails,
      currentMemory.qualificationStage,
      shouldEnterHumanReview,
    );
    const workflowEvents: WorkflowEvent[] = [
      {
        type: "MESSAGE_RECEIVED",
        step: "message_received",
        payload: { promptLength: prompt.length },
      },
      {
        type: "DETERMINISTIC_ROUTE_MATCHED",
        step: "deterministic_routing",
        payload: {
          route: responseRoute,
          matchedBy: "keyword",
          reason: contactCompletionResponse
            ? "contact_details_completed"
            : "contact_details_confirmed",
        },
      },
      {
        type: "STATIC_RESPONSE_SENT",
        step: shouldEnterHumanReview
          ? "waiting_for_human_review"
          : "route_resolved",
        payload: { route: responseRoute },
      },
    ];

    if (shouldEnterHumanReview) {
      workflowEvents.push({
        type: "HUMAN_REVIEW_REQUIRED",
        step: "waiting_for_human_review",
        payload: { route: responseRoute, source: "deterministic_followup" },
      });
    }

    await persistDeterministicWorkflowTurn({
      leadId: session.leadId,
      workflowId: session.workflowId,
      userMessage: prompt,
      assistantMessage: responseText,
      route: responseRoute,
      currentStep: shouldEnterHumanReview
        ? "waiting_for_human_review"
        : "route_resolved",
      status: shouldEnterHumanReview ? "waiting_for_human_review" : "active",
      leadDetails: getLeadDetailsPatch(mergedLeadDetails),
      leadProfile: currentMemory.leadProfile,
      intentSignals: nextIntentSignals,
      interactionState: nextInteractionState,
      qualificationStage: nextQualificationStage,
      events: workflowEvents,
      result: {
        source: "deterministic",
        responseText,
      },
    });

    logWorkflowDebug("deterministic_contact_followup_persisted", {
      workflowId: session.workflowId,
      route: responseRoute,
      responseText,
      nextIntentSignals,
      nextInteractionState,
      nextQualificationStage,
    });

    logWorkflowDebug("memory_snapshot", {
      workflowId: session.workflowId,
      route: responseRoute,
      qualificationStage: nextQualificationStage,
      leadProfile: currentMemory.leadProfile,
      intentSignals: nextIntentSignals,
      interactionState: nextInteractionState,
      knownLead: mergedLeadDetails,
    });

    return Response.json({
      ok: true,
      leadId: session.leadId,
      workflowId: session.workflowId,
      prompt,
      text: responseText,
      route: responseRoute,
      currentStep: shouldEnterHumanReview
        ? "waiting_for_human_review"
        : "route_resolved",
      events: workflowEvents,
    });
  }

  const workflowEvents: WorkflowEvent[] = [
    {
      type: "MESSAGE_RECEIVED",
      step: "message_received",
      payload: { promptLength: prompt.length },
    },
  ];

  const deterministicResult = routeDeterministically(prompt);
  workflowEvents.push(...deterministicResult.events);

  logWorkflowDebug("deterministic_route_evaluated", {
    workflowId: session.workflowId,
    route: deterministicResult.route,
    matched: deterministicResult.matched,
    matchedBy: deterministicResult.matchedBy,
    events: deterministicResult.events,
  });

  if (deterministicResult.matched && deterministicResult.route !== "needs_ai_analysis") {
    const shouldEnterHumanReview =
      isHumanReviewCandidateRoute(deterministicResult.route) &&
      getMissingContactFields(mergedLeadDetails).length === 0;
    const responseText = shouldEnterHumanReview
      ? buildPendingReviewResponse(
          deterministicResult.route,
          mergedLeadDetails,
        )
      : buildRouteResponse(
          deterministicResult.route,
          mergedLeadDetails,
          currentMemory.leadProfile,
        );
    const nextIntentSignals = mergeIntentSignals(
      currentMemory.intentSignals,
      deriveIntentSignalsFromRoute(deterministicResult.route),
    );
    const nextInteractionState = computeInteractionStateFromRoute({
      route: deterministicResult.route,
      lead: mergedLeadDetails,
      leadProfile: currentMemory.leadProfile,
      previousState: currentMemory.interactionState,
      hasAskedForQualificationDetails:
        currentMemory.interactionState.hasAskedForQualificationDetails ||
        responseAsksForQualification(responseText),
    });
    const nextQualificationStage = deriveQualificationStage(
      deterministicResult.route,
      mergedLeadDetails,
      currentMemory.qualificationStage,
      shouldEnterHumanReview,
    );
    if (shouldEnterHumanReview) {
      workflowEvents.push({
        type: "HUMAN_REVIEW_REQUIRED",
        step: "waiting_for_human_review",
        payload: { route: deterministicResult.route, source: "deterministic" },
      });
    }

    await persistDeterministicWorkflowTurn({
      leadId: session.leadId,
      workflowId: session.workflowId,
      userMessage: prompt,
      assistantMessage: responseText ?? "",
      route: deterministicResult.route,
      currentStep: shouldEnterHumanReview
        ? "waiting_for_human_review"
        : deterministicResult.currentStep,
      status: shouldEnterHumanReview ? "waiting_for_human_review" : "active",
      leadDetails: getLeadDetailsPatch(mergedLeadDetails),
      leadProfile: currentMemory.leadProfile,
      intentSignals: nextIntentSignals,
      interactionState: nextInteractionState,
      qualificationStage: nextQualificationStage,
      events: workflowEvents,
      result: {
        source: "deterministic",
        responseText,
      },
    });

    logWorkflowDebug("deterministic_turn_persisted", {
      workflowId: session.workflowId,
      route: deterministicResult.route,
      currentStep: shouldEnterHumanReview
        ? "waiting_for_human_review"
        : deterministicResult.currentStep,
      responseText,
      nextIntentSignals,
      nextInteractionState,
      nextQualificationStage,
    });

    logWorkflowDebug("memory_snapshot", {
      workflowId: session.workflowId,
      route: deterministicResult.route,
      qualificationStage: nextQualificationStage,
      leadProfile: currentMemory.leadProfile,
      intentSignals: nextIntentSignals,
      interactionState: nextInteractionState,
      knownLead: mergedLeadDetails,
    });

    return Response.json({
      ok: true,
      leadId: session.leadId,
      workflowId: session.workflowId,
      prompt,
      text: responseText,
      route: deterministicResult.route,
      currentStep: shouldEnterHumanReview
        ? "waiting_for_human_review"
        : deterministicResult.currentStep,
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

  await persistAiAnalysisStart({
    leadId: session.leadId,
    workflowId: session.workflowId,
    userMessage: prompt,
    route: deterministicResult.route,
    leadDetails: getLeadDetailsPatch(mergedLeadDetails),
    leadProfile: currentMemory.leadProfile,
    intentSignals: currentMemory.intentSignals,
    interactionState: currentMemory.interactionState,
    qualificationStage: currentMemory.qualificationStage,
    events: [...workflowEvents, ...aiStartEvents],
    result: {
      source: "deterministic",
      fallbackReason: "no_deterministic_match",
    },
  });

  logWorkflowDebug("ai_analysis_started", {
    workflowId: session.workflowId,
    route: deterministicResult.route,
    currentStep: "ai_analysis_running",
  });

  let analysis: MessageAnalysis;

  try {
    analysis = await analyzeMessage({
      userMessage: prompt,
      recentMessages: initialContext.recentMessages,
      knownLead: mergedLeadDetails,
      leadProfile: currentMemory.leadProfile,
      intentSignals: currentMemory.intentSignals,
      interactionState: currentMemory.interactionState,
      workflow: {
        route: deterministicResult.route,
        currentStep: "ai_analysis_running",
        qualificationStage: currentMemory.qualificationStage,
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

    logWorkflowDebug("ai_analysis_failed", {
      workflowId: session.workflowId,
      error: error instanceof Error ? error.message : "Unknown AI analysis error",
    });

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
  const useCaseFallback =
    analysis.leadProfilePatch.useCase ??
    extractUseCaseFromReply(prompt, initialContext.recentMessages);
  const budgetFallback =
    analysis.leadProfilePatch.budget ??
    extractBudgetFromReply(prompt, initialContext.recentMessages);

  const nextLeadProfile = mergeLeadProfile(
    currentMemory.leadProfile,
    {
      ...analysis.leadProfilePatch,
      useCase: useCaseFallback,
      budget: budgetFallback,
    },
  );
  const nextIntentSignals = mergeIntentSignals(
    mergeIntentSignals(
      currentMemory.intentSignals,
      deriveIntentSignalsFromRoute(analysis.route),
    ),
    analysis.intentSignalsPatch,
  );
  const responseText =
    analysis.requiresHumanReview
      ? buildPendingReviewResponse(analysis.route, resolvedLeadDetails)
      : analysis.route === "clarification_required"
        ? buildRouteResponse(
            analysis.route,
            resolvedLeadDetails,
            nextLeadProfile,
            analysis.responseText,
          )
        : buildRouteResponse(
            analysis.route,
            resolvedLeadDetails,
            nextLeadProfile,
          );
  const nextInteractionState = computeInteractionStateFromRoute({
    route: analysis.route,
    lead: resolvedLeadDetails,
    leadProfile: nextLeadProfile,
    previousState: currentMemory.interactionState,
    qualificationPatch: analysis.interactionStatePatch,
    hasAskedForQualificationDetails:
      analysis.interactionStatePatch.hasAskedForQualificationDetails ??
      (responseAsksForQualification(responseText) ||
        analysis.route === "clarification_required"),
  });

  const currentStep = analysis.requiresHumanReview
    ? "waiting_for_human_review"
    : "route_resolved";
  const status = analysis.requiresHumanReview
    ? "waiting_for_human_review"
    : "active";
  const nextQualificationStage = deriveQualificationStage(
    analysis.route,
    resolvedLeadDetails,
    analysis.nextQualificationStage,
    analysis.requiresHumanReview,
  );

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

  logWorkflowDebug("ai_analysis_completed", {
    workflowId: session.workflowId,
    route: analysis.route,
    confidence: analysis.confidence,
    requiresHumanReview: analysis.requiresHumanReview,
    currentStep,
    responseText: responseText ?? analysis.responseText,
    extractedContact: analysis.extractedContact,
    leadProfilePatch: analysis.leadProfilePatch,
    intentSignalsPatch: analysis.intentSignalsPatch,
    interactionStatePatch: analysis.interactionStatePatch,
    nextQualificationStage,
  });

  await persistAiAnalysisCompletion({
    leadId: session.leadId,
    workflowId: session.workflowId,
    assistantMessage: responseText ?? analysis.responseText,
    route: analysis.route,
    currentStep,
    status,
    leadDetails: getLeadDetailsFromAnalysis(analysis),
    leadProfile: nextLeadProfile,
    intentSignals: nextIntentSignals,
    interactionState: nextInteractionState,
    qualificationStage: nextQualificationStage,
    events: analysisEvents,
    result: {
      source: "ai_analysis",
      analysis,
    },
  });

  logWorkflowDebug("ai_turn_persisted", {
    workflowId: session.workflowId,
    route: analysis.route,
    currentStep,
    status,
    nextLeadProfile,
    nextIntentSignals,
    nextInteractionState,
    nextQualificationStage,
  });

  logWorkflowDebug("memory_snapshot", {
    workflowId: session.workflowId,
    route: analysis.route,
    qualificationStage: nextQualificationStage,
    leadProfile: nextLeadProfile,
    intentSignals: nextIntentSignals,
    interactionState: nextInteractionState,
    knownLead: resolvedLeadDetails,
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
