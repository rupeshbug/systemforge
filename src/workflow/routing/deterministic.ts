import type {
  DeterministicRoute,
  DeterministicRoutingResult,
  MatchType,
  WorkflowEvent,
} from "@/src/workflow/routing/types";

type RouteMatcher = {
  route: Exclude<DeterministicRoute, "needs_ai_analysis">;
  exactPhrases: string[];
  keywordGroups: string[][];
  minScore: number;
  matchType: MatchType;
};

type RouteMatch = {
  score: number;
  matchedPhrases: string[];
  matchedKeywordGroups: string[][];
};

const GREETING_PHRASES = [
  "hello",
  "hi",
  "hey",
  "good morning",
  "good afternoon",
] as const;

const ROUTE_MATCHERS: RouteMatcher[] = [
  {
    route: "greeting",
    matchType: "keyword",
    exactPhrases: [...GREETING_PHRASES],
    keywordGroups: [],
    minScore: 3,
  },
  {
    route: "pricing",
    matchType: "phrase",
    exactPhrases: [
      "pricing",
      "how much",
      "plan details",
      "pricing details",
      "pricing information",
      "what does it cost",
      "what is the cost",
      "which plan",
      "plan pricing",
      "quotation",
      "request a quote",
      "need a quote",
    ],
    keywordGroups: [
      ["price"],
      ["cost"],
      ["pricing", "plan"],
      ["plan", "fit"],
      ["plans", "pricing"],
      ["budget", "pricing"],
      ["quote"],
      ["rates"],
    ],
    minScore: 2,
  },
  {
    route: "demo_request",
    matchType: "phrase",
    exactPhrases: [
      "book a demo",
      "schedule a demo",
      "see a demo",
      "product demo",
      "arrange a demo",
      "live demo",
      "request a demo",
      "show me the product",
      "show us the product",
      "walk me through the platform",
      "walk us through the platform",
    ],
    keywordGroups: [
      ["demo"],
      ["product", "walkthrough"],
      ["platform", "walkthrough"],
      ["show", "product"],
      ["see", "product"],
      ["walkthrough", "platform"],
    ],
    minScore: 2,
  },
  {
    route: "human_contact",
    matchType: "phrase",
    exactPhrases: [
      "talk to sales",
      "contact sales",
      "contact your team",
      "speak to someone",
      "someone from sales",
      "call me",
      "reach out to me",
      "contact me",
      "sales contact",
      "speak to sales",
      "talk to your team",
      "customized solution",
      "customized solutions",
      "custom solution",
      "custom solutions",
      "tailored solution",
      "tailored solutions",
      "bespoke solution",
      "enterprise solution",
      "enterprise solutions",
    ],
    keywordGroups: [
      ["talk", "sales"],
      ["contact", "sales"],
      ["speak", "sales"],
      ["sales", "team"],
      ["custom", "solution"],
      ["customized", "solution"],
      ["tailored", "solution"],
      ["bespoke", "solution"],
      ["enterprise", "solution"],
      ["enterprise", "team"],
    ],
    minScore: 2,
  },
  {
    route: "onboarding",
    matchType: "phrase",
    exactPhrases: [
      "onboarding",
      "help me onboard",
      "help with onboarding",
      "onboard us",
      "onboard my team",
      "onboarding help",
      "setup help",
      "implementation help",
      "kickoff",
      "rollout help",
      "help us implement",
      "help us set up",
    ],
    keywordGroups: [
      ["onboard"],
      ["onboarding"],
      ["setup", "help"],
      ["implementation", "help"],
      ["rollout", "help"],
      ["go", "live"],
      ["get", "started", "setup"],
      ["start", "using", "platform"],
    ],
    minScore: 2,
  },
  {
    route: "irrelevant",
    matchType: "phrase",
    exactPhrases: [
      "weather",
      "sports score",
      "movie recommendation",
      "recipe",
      "tell me a joke",
    ],
    keywordGroups: [],
    minScore: 3,
  },
];

function normalizeMessage(message: string) {
  return message
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeMessage(message: string) {
  return normalizeMessage(message).split(" ").filter(Boolean);
}

function hasWholePhrase(message: string, phrase: string) {
  return (` ${message} `).includes(` ${phrase} `);
}

function isGreetingOnly(message: string) {
  const normalized = normalizeMessage(message);
  return GREETING_PHRASES.includes(
    normalized as (typeof GREETING_PHRASES)[number],
  );
}

function getRouteMatch(
  normalizedMessage: string,
  messageTokens: Set<string>,
  matcher: RouteMatcher,
): RouteMatch | null {
  const matchedPhrases = matcher.exactPhrases.filter((phrase) =>
    hasWholePhrase(normalizedMessage, phrase),
  );

  const matchedKeywordGroups = matcher.keywordGroups.filter((group) =>
    group.every((token) => messageTokens.has(token)),
  );

  const score = matchedPhrases.length * 3 + matchedKeywordGroups.length * 2;

  if (score < matcher.minScore) {
    return null;
  }

  return {
    score,
    matchedPhrases,
    matchedKeywordGroups,
  };
}

function buildMatchedResult(
  route: Exclude<DeterministicRoute, "needs_ai_analysis">,
  matchedBy: MatchType,
  payload?: Record<string, unknown>,
): DeterministicRoutingResult {
  const events: WorkflowEvent[] = [
    {
      type: "DETERMINISTIC_ROUTE_MATCHED",
      step: "deterministic_routing",
      payload: { route, matchedBy, ...payload },
    },
  ];

  events.push({
    type: "STATIC_RESPONSE_SENT",
    step: "route_resolved",
    payload: { route },
  });

  return {
    route,
    matched: true,
    matchedBy,
    currentStep: "route_resolved",
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
  const tokens = new Set(tokenizeMessage(message));
  let bestMatch:
    | {
        route: Exclude<DeterministicRoute, "needs_ai_analysis">;
        matchedBy: MatchType;
        score: number;
        matchedPhrases: string[];
        matchedKeywordGroups: string[][];
      }
    | null = null;

  for (const matcher of ROUTE_MATCHERS) {
    const match = getRouteMatch(normalized, tokens, matcher);

    if (!match) {
      continue;
    }

    if (!bestMatch || match.score > bestMatch.score) {
      bestMatch = {
        route: matcher.route,
        matchedBy: matcher.matchType,
        score: match.score,
        matchedPhrases: match.matchedPhrases,
        matchedKeywordGroups: match.matchedKeywordGroups,
      };
    }
  }

  if (bestMatch) {
    return buildMatchedResult(bestMatch.route, bestMatch.matchedBy, {
      score: bestMatch.score,
      matchedPhrases: bestMatch.matchedPhrases,
      matchedKeywordGroups: bestMatch.matchedKeywordGroups,
    });
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
