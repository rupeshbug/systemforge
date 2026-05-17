import { groq } from "@ai-sdk/groq";
import { generateText } from "ai";
import { RESPONSE_SYSTEM_PROMPT } from "@/src/workflow/prompts/systemPrompt";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const prompt =
    typeof body.prompt === "string" ? body.prompt : "I want to book a meeting.";

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
