import { getWorkflowSessionSnapshot } from "@/src/workflow/persistence";

type RouteContext = {
  params: Promise<{
    workflowId: string;
  }>;
};

function logWorkflowDebug(stage: string, details: Record<string, unknown>) {
  if (process.env.WORKFLOW_DEBUG !== "true") {
    return;
  }

  console.log(`[WorkflowDebug] ${stage}`, details);
}

export async function GET(request: Request, context: RouteContext) {
  const { workflowId } = await context.params;
  const { searchParams } = new URL(request.url);
  const leadId = searchParams.get("leadId");

  logWorkflowDebug("session_snapshot_requested", {
    workflowId,
    leadId,
  });

  if (!workflowId || !leadId) {
    logWorkflowDebug("session_snapshot_rejected", {
      workflowId,
      leadId,
      reason: "missing_identifiers",
    });

    return Response.json(
      {
        ok: false,
        error: "workflowId and leadId are required.",
      },
      { status: 400 },
    );
  }

  const snapshot = await getWorkflowSessionSnapshot(workflowId, leadId);

  if (!snapshot) {
    logWorkflowDebug("session_snapshot_not_found", {
      workflowId,
      leadId,
    });

    return Response.json(
      {
        ok: false,
        error: "Workflow session not found.",
      },
      { status: 404 },
    );
  }

  logWorkflowDebug("session_snapshot_restored", {
    workflowId,
    leadId,
    route: snapshot.route,
    currentStep: snapshot.currentStep,
    status: snapshot.status,
    messageCount: snapshot.messages.length,
  });

  return Response.json({
    ok: true,
    ...snapshot,
  });
}
