import { groq } from "@ai-sdk/groq";
import { generateText, Output } from "ai";
import type {
  InteractionState,
  IntentSignals,
  LeadProfile,
  QualificationStage,
} from "@/src/workflow/memory";
import type { WorkflowStep } from "@/src/workflow/states";
import { MESSAGE_ANALYSIS_SYSTEM_PROMPT } from "@/src/workflow/analysis/prompt";
import {
  MessageAnalysisSchema,
  type MessageAnalysis,
} from "@/src/workflow/analysis/schema";
import type { WorkflowRoute } from "@/src/workflow/routing/types";

type ConversationMessage = {
  role: "user" | "assistant";
  content: string;
};

type AnalyzeMessageInput = {
  userMessage: string;
  recentMessages: ConversationMessage[];
  knownLead: {
    name: string | null;
    businessName: string | null;
    email: string | null;
    phone: string | null;
  };
  leadProfile: LeadProfile;
  intentSignals: IntentSignals;
  interactionState: InteractionState;
  workflow: {
    route: WorkflowRoute | null;
    currentStep: WorkflowStep;
    qualificationStage: QualificationStage;
  };
};

export async function analyzeMessage({
  userMessage,
  recentMessages,
  knownLead,
  leadProfile,
  intentSignals,
  interactionState,
  workflow,
}: AnalyzeMessageInput): Promise<MessageAnalysis> {
  const { output } = await generateText({
    model: groq("meta-llama/llama-4-scout-17b-16e-instruct"),
    system: MESSAGE_ANALYSIS_SYSTEM_PROMPT,
    output: Output.object({
      schema: MessageAnalysisSchema,
    }),
    prompt: JSON.stringify(
      {
        latestUserMessage: userMessage,
        workflow,
        knownLead,
        leadProfile,
        intentSignals,
        interactionState,
        recentMessages,
      },
      null,
      2,
    ),
  });

  return output as MessageAnalysis;
}
