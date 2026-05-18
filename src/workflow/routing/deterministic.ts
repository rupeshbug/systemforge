import { getStaticResponse } from "@/src/workflow/routing/staticResponses";
import type {
  DeterministicRoute,
  DeterministicRoutingResult,
  MatchType,
  WorkflowEvent,
} from "@/src/workflow/routing/types";

type RouteMatcher = {
  route: Exclude<DeterministicRoute, "needs_ai_analysis">;
  phrases: string[];
  matchType: MatchType;
};

const ROUTE_MATCHERS: RouteMatcher[] = [
  {
    route: "greeting",
    matchType: "keyword",
    phrases: ["hello", "hi", "hey", "good morning", "good afternoon"],
  },
  {
    route: "pricing",
    matchType: "phrase",
    phrases: [
      "pricing",
      "price",
      "cost",
      "how much",
      "plans",
      "plan details",
      "quote",
      "quotation",
      "rates",
    ],
  },
  {
    route: "demo_request",
    matchType: "phrase",
    phrases: [
      "book a demo",
      "schedule a demo",
      "demo",
      "see a demo",
      "product demo",
      "arrange a demo",
    ],
  },
  {
    route: "human_contact",
    matchType: "phrase",
    phrases: [
      "talk to sales",
      "contact sales",
      "contact your team",
      "speak to someone",
      "someone from sales",
      "call me",
      "reach out to me",
      "contact me",
    ],
  },
  {
    route: "onboarding",
    matchType: "phrase",
    phrases: [
      "onboarding",
      "get started",
      "setup help",
      "implementation help",
      "start using",
      "kickoff",
    ],
  },
  {
    route: "irrelevant",
    matchType: "phrase",
    phrases: [
      "weather",
      "sports score",
      "movie recommendation",
      "recipe",
      "tell me a joke",
    ],
  },
];

function normalizeMessage(message: string) {
  return message.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
}

function isGreetingOnly(message: string) {
  const normalized = normalizeMessage(message);
  return ["hello", "hi", "hey", "good morning", "good afternoon"].includes(
    normalized,
  );
}

function buildMatchedResult(
  route: Exclude<DeterministicRoute, "needs_ai_analysis">,
  matchedBy: MatchType,
): DeterministicRoutingResult {
  const responseText = getStaticResponse(route) ?? undefined;
  const events: WorkflowEvent[] = [
    {
      type: "DETERMINISTIC_ROUTE_MATCHED",
      step: "deterministic_routing",
      payload: { route, matchedBy },
    },
  ];

  if (responseText) {
    events.push({
      type: "STATIC_RESPONSE_SENT",
      step: "route_resolved",
      payload: { route },
    });
  }

  return {
    route,
    matched: true,
    matchedBy,
    currentStep: responseText ? "completed" : "route_resolved",
    responseText,
    events,
  };
}

export function routeDeterministically(
  message: string,
): DeterministicRoutingResult {
  if (isGreetingOnly(message)) {
    return buildMatchedResult("greeting", "keyword");
  }

  const normalized = normalizeMessage(message);

  for (const matcher of ROUTE_MATCHERS) {
    const didMatch = matcher.phrases.some((phrase) =>
      normalized.includes(phrase),
    );

    if (didMatch) {
      return buildMatchedResult(matcher.route, matcher.matchType);
    }
  }

  return {
    route: "needs_ai_analysis",
    matched: false,
    matchedBy: "fallback",
    currentStep: "ai_analysis_required",
    events: [
      {
        type: "DETERMINISTIC_ROUTE_NOT_FOUND",
        step: "deterministic_routing",
      },
      {
        type: "AI_ANALYSIS_REQUIRED",
        step: "ai_analysis_required",
        payload: { reason: "no_deterministic_match" },
      },
    ],
  };
}
