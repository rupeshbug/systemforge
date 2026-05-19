import type { WorkflowRoute } from "@/src/workflow/routing/types";
import {
  formatContactFieldList,
  getMissingContactFields,
  type KnownLeadDetails,
} from "@/src/workflow/lead/contactDetails";

export function buildRouteResponse(
  route: WorkflowRoute,
  lead: KnownLeadDetails | null | undefined,
  fallbackText?: string,
) {
  const missingContactFields = getMissingContactFields(lead);
  const missingFieldsText = formatContactFieldList(missingContactFields);
  const contactAsk =
    missingContactFields.length > 0
      ? `Please share your ${missingFieldsText} so our team can follow up properly.`
      : null;

  switch (route) {
    case "greeting":
      return "Hello and welcome to SystemForge. How can I help with your sales or onboarding questions today?";
    case "pricing":
      return contactAsk
        ? `We can help with pricing and plan guidance. ${contactAsk}`
        : "We can help with pricing and plan guidance. Our team can follow up with the right next step.";
    case "demo_request":
      return contactAsk
        ? `We would be happy to arrange a demo. ${contactAsk}`
        : "We would be happy to arrange a demo. Let us know what you'd like to see most, and our team can follow up with the right walkthrough.";
    case "human_contact":
      return contactAsk
        ? `Our team can get in touch with you directly. ${contactAsk}`
        : "Our team can get in touch with you directly. If there is a specific requirement or use case you'd like to discuss, let us know.";
    case "onboarding":
      return contactAsk
        ? `We can help you get started with onboarding. ${contactAsk}`
        : "We can help you get started with onboarding. Please share a short note about your setup needs or implementation timeline.";
    case "irrelevant":
      return "I can help with sales, pricing, demos, onboarding, and business-related questions about SystemForge. Let me know what your team needs.";
    case "clarification_required":
      return fallbackText ?? "Could you share a bit more about what your team is looking for?";
    case "needs_ai_analysis":
      return fallbackText ?? null;
    default:
      return fallbackText ?? null;
  }
}
