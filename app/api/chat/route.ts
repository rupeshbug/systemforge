import { groq } from "@ai-sdk/groq";
import { generateText } from "ai";
import { RESPONSE_SYSTEM_PROMPT } from "@/src/workflow/prompts/systemPrompt";

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

  const result = await generateText({
    model: groq("meta-llama/llama-4-scout-17b-16e-instruct"),
    system: RESPONSE_SYSTEM_PROMPT,
    prompt,
  });

  console.log("[/api/chat] prompt:", prompt);
  console.log("[/api/chat] text:", result.text);

  return Response.json({
    ok: true,
    prompt,
    text: result.text,
  });
}
