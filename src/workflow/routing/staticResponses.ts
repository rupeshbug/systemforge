import type { DeterministicRoute } from "@/src/workflow/routing/types";

const CONTACT_DETAILS_REQUEST =
  "Please also share your name, business name, email, and phone number so our team can follow up properly.";

const STATIC_RESPONSES: Partial<Record<DeterministicRoute, string>> = {
  greeting:
    "Hello and welcome to SystemForge. How can I help with your sales or onboarding questions today?",
  pricing: `We can help with pricing and plan guidance. Please share your name, business name, email, and phone number, plus a short note about your team size or use case so we can recommend the right next step.`,
  demo_request: `We would be happy to arrange a demo. ${CONTACT_DETAILS_REQUEST}`,
  human_contact: `Our team can get in touch with you directly. ${CONTACT_DETAILS_REQUEST}`,
  onboarding: `We can help you get started with onboarding. ${CONTACT_DETAILS_REQUEST}`,
  irrelevant:
    "I can help with sales, pricing, demos, onboarding, and business-related questions about SystemForge. Let me know what your team needs.",
};

export function getStaticResponse(route: DeterministicRoute) {
  return STATIC_RESPONSES[route] ?? null;
}
