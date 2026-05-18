import { groq } from "@ai-sdk/groq";
import { generateText } from "ai";
import { RESPONSE_SYSTEM_PROMPT } from "@/src/workflow/prompts/systemPrompt";
import { routeDeterministically } from "@/src/workflow/routing/deterministic";
import type { WorkflowEvent } from "@/src/workflow/routing/types";

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

  const prompt =
    typeof body === "object" &&
    body !== null &&
    "prompt" in body &&
    typeof body.prompt === "string"
      ? body.prompt
      : "";

  if (!prompt.trim()) {
    return Response.json(
      {
        ok: false,
        error: "Prompt is required.",
      },
      { status: 400 },
    );
  }

  const workflowEvents: WorkflowEvent[] = [
    {
      type: "MESSAGE_RECEIVED",
      step: "message_received",
      payload: { promptLength: prompt.trim().length },
    },
  ];

  const deterministicResult = routeDeterministically(prompt);
  workflowEvents.push(...deterministicResult.events);

  if (deterministicResult.responseText) {
    console.log("[/api/chat] route:", deterministicResult.route);
    console.log("[/api/chat] step:", deterministicResult.currentStep);
    console.log("[/api/chat] text:", deterministicResult.responseText);

    return Response.json({
      ok: true,
      prompt,
      text: deterministicResult.responseText,
      route: deterministicResult.route,
      currentStep: deterministicResult.currentStep,
      events: workflowEvents,
    });
  }

  workflowEvents.push({
    type: "AI_ANALYSIS_STARTED",
    step: "ai_analysis_running",
    payload: { route: deterministicResult.route },
  });

  const result = await generateText({
    model: groq("meta-llama/llama-4-scout-17b-16e-instruct"),
    system: RESPONSE_SYSTEM_PROMPT,
    prompt,
  });

  workflowEvents.push({
    type: "AI_RESPONSE_GENERATED",
    step: "completed",
    payload: { route: deterministicResult.route },
  });

  console.log("[/api/chat] prompt:", prompt);
  console.log("[/api/chat] route:", deterministicResult.route);
  console.log("[/api/chat] text:", result.text);

  return Response.json({
    ok: true,
    prompt,
    text: result.text,
    route: deterministicResult.route,
    currentStep: "completed",
    events: workflowEvents,
  });
}
