import type { WorkflowRoute } from "@/src/workflow/routing/types";
import {
  formatContactFieldList,
  getMissingContactFields,
  type KnownLeadDetails,
} from "@/src/workflow/lead/contactDetails";
import {
  getMissingQualificationFields,
  type LeadProfile,
} from "@/src/workflow/memory";

function hasCompleteRequiredContactDetails(
  lead: KnownLeadDetails | null | undefined,
) {
  return getMissingContactFields(lead).length === 0;
}

function buildRouteFollowUp(route: WorkflowRoute | null | undefined) {
  switch (route) {
    case "pricing":
      return "Our team can follow up with the right pricing next step.";
    case "demo_request":
      return "Our team can follow up with the right demo next step.";
    case "human_contact":
      return "Our team can follow up with you directly from here.";
    case "onboarding":
      return "Our team can follow up with the right onboarding next step.";
    default:
      return "Our team can follow up with the right next step.";
  }
}

export function buildContactCompletionResponse(
  route: WorkflowRoute | null | undefined,
  previousLead: KnownLeadDetails | null | undefined,
  currentLead: KnownLeadDetails | null | undefined,
  leadProfile?: LeadProfile | null,
) {
  const hadMissingContactDetails =
    getMissingContactFields(previousLead).length > 0;

  if (
    !hadMissingContactDetails ||
    !hasCompleteRequiredContactDetails(currentLead)
  ) {
    return null;
  }

  switch (route) {
    case "pricing":
      return (
        "Thanks, I have your contact details now. " +
        (buildQualificationPrompt("pricing", leadProfile) ??
          "Our team can follow up on pricing from here.")
      );
    case "demo_request":
      return (
        "Thanks, I have your contact details now. " +
        (buildQualificationPrompt("demo_request", leadProfile) ??
          "Our team can follow up with the demo next step.")
      );
    case "human_contact":
      return (
        "Thanks, I have your contact details now. " +
        (buildQualificationPrompt("human_contact", leadProfile) ??
          "Our team can reach out directly from here.")
      );
    case "onboarding":
      return (
        "Thanks, I have your contact details now. " +
        (buildQualificationPrompt("onboarding", leadProfile) ??
          "Our team can follow up with the onboarding next step.")
      );
    default:
      return "Thanks, I have your contact details now. Our team can follow up with the right next step.";
  }
}

export function buildContactConfirmationResponse(
  route: WorkflowRoute | null | undefined,
  lead: KnownLeadDetails | null | undefined,
) {
  if (!hasCompleteRequiredContactDetails(lead)) {
    return null;
  }

  return `Yes, I have your name, email, and phone number on file. ${buildRouteFollowUp(route)}`;
}

export function buildRouteResponse(
  route: WorkflowRoute,
  lead: KnownLeadDetails | null | undefined,
  leadProfile?: LeadProfile | null,
  fallbackText?: string,
) {
  const missingContactFields = getMissingContactFields(lead);
  const missingFieldsText = formatContactFieldList(missingContactFields);
  const contactAsk =
    missingContactFields.length > 0
      ? `Please share your ${missingFieldsText} so our team can follow up properly.`
      : null;
  const qualificationPrompt = buildQualificationPrompt(route, leadProfile);

  switch (route) {
    case "greeting":
      return "Hello and welcome to SystemForge. How can I help with your sales or onboarding questions today?";
    case "pricing":
      return contactAsk
        ? `We can help with pricing and plan guidance. ${contactAsk}`
        : (qualificationPrompt ??
            "Thanks, that's helpful. Our team can review your pricing needs and follow up with the right next step.");
    case "demo_request":
      return contactAsk
        ? `We would be happy to arrange a demo. ${contactAsk}`
        : (qualificationPrompt ??
            "Thanks, that's helpful. Our team can follow up with the right demo next step.");
    case "human_contact":
      return contactAsk
        ? `Our team can get in touch with you directly. ${contactAsk}`
        : (qualificationPrompt ??
            "Thanks, that's helpful. Our team can follow up with you directly from here.");
    case "onboarding":
      return contactAsk
        ? `We can help you get started with onboarding. ${contactAsk}`
        : (qualificationPrompt ??
            "Thanks, that's helpful. Our team can follow up with the right onboarding next step.");
    case "irrelevant":
      return "I can help with sales, pricing, demos, onboarding, and business-related questions about SystemForge. Let me know what your team needs.";
    case "clarification_required":
      if (fallbackText && contactAsk) {
        return `${fallbackText} ${contactAsk}`;
      }

      return (
        fallbackText ??
        (contactAsk
          ? `Could you share a bit more about what your team is looking for? ${contactAsk}`
          : "Could you share a bit more about what your team is looking for?")
      );
    case "needs_ai_analysis":
      return fallbackText ?? null;
    default:
      return fallbackText ?? null;
  }
}

function buildQualificationPrompt(
  route: WorkflowRoute,
  leadProfile: LeadProfile | null | undefined,
) {
  const missingFields = getMissingQualificationFields(leadProfile);

  if (missingFields.length === 0) {
    return null;
  }

  switch (route) {
    case "pricing":
      if (missingFields.includes("useCase")) {
        return "Could you share a short note about your use case so we can guide pricing more accurately?";
      }

      if (missingFields.includes("budget")) {
        return "If you already have a budget range in mind, feel free to share it so we can guide pricing more accurately.";
      }

      return "Our team can follow up with the right pricing next step.";
    case "demo_request":
      if (missingFields.includes("useCase")) {
        return "What would you like your team to see most in the demo?";
      }

      if (missingFields.includes("timeline")) {
        return "Do you already have a target timeline for this demo or rollout?";
      }

      return "Our team can follow up with the right demo next step.";
    case "human_contact":
      if (missingFields.includes("useCase")) {
        return "If you can share a short note about your use case or requirement, our team can follow up more effectively.";
      }

      return "Our team can follow up with you directly from here.";
    case "onboarding":
      if (missingFields.includes("useCase")) {
        return "Could you share a short note about your setup needs so we can guide the onboarding next step?";
      }

      if (missingFields.includes("timeline")) {
        return "Do you already have a target onboarding timeline in mind?";
      }

      return "Our team can follow up with the right onboarding next step.";
    default:
      return null;
  }
}
