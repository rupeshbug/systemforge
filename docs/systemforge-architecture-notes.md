# SystemForge Technical Architecture Notes

## What SystemForge Is

SystemForge is a workflow-first AI lead qualification system.

It is not designed as a generic chatbot where every user message goes straight to an LLM and the model controls the whole experience.

Instead, the system treats AI as one step inside a controlled runtime.

That runtime is responsible for:

- validating input
- creating or resuming workflow sessions
- saving conversation messages
- running deterministic routing first
- falling back to structured AI analysis only when needed
- persisting workflow state
- persisting workflow events
- pausing for human review when required
- resuming the same workflow later

The conversation stays attached to one durable workflow instead of becoming a bunch of separate chats.

That is an important design choice because we want workflow state to survive beyond one request.

---

## Core Design Goal

The core goal behind this system is:

```txt
AI suggests.
Runtime decides.
Human approves when needed.
Workflow history persists everything.
```

This goal influenced almost every technical decision in the codebase.

For example:

- deterministic routing runs before AI
- workflow state is persisted in the database
- lead context is merged and remembered across turns
- human review is a real workflow pause, not just a UI label
- the same workflow can be resumed later from the database

---

## High-Level Request Flow

The main request flow is implemented in [app/api/chat/route.ts](/c:/Users/Lenovo/Desktop/stateforge/app/api/chat/route.ts).

At a high level, every incoming message goes through this process:

```txt
message
-> workflow session
-> save / merge lead context
-> deterministic routing
-> deterministic response OR AI analysis
-> save assistant reply
-> save workflow state
-> save workflow events
```

A slightly more detailed version is:

```txt
1. validate prompt, workflowId, and leadId
2. create or resume a workflow session
3. load current workflow context from DB
4. extract lead details from the latest message
5. merge them with already-known lead details
6. run deterministic routing first
7. if deterministic match is safe, respond immediately
8. otherwise call analyzeMessage for structured AI analysis
9. persist assistant response, workflow state, and workflow events
10. return workflowId and leadId so the client can continue the same workflow
```

This design makes the runtime the owner of workflow execution, not the model.

---

## Why We Used Deterministic Routing First

One of the most important architectural decisions in SystemForge is deterministic routing before LLM routing.

Why we used it:

- some messages are obvious and do not need an LLM
- deterministic routing is cheaper
- deterministic routing is faster
- deterministic routing is easier to reason about
- deterministic routing keeps the system in control

Examples of clear routes:

- greeting
- pricing
- demo request
- human contact request
- onboarding
- irrelevant messages

The deterministic router is implemented in [src/workflow/routing/deterministic.ts](/c:/Users/Lenovo/Desktop/stateforge/src/workflow/routing/deterministic.ts).

It is not perfect, and that is okay.

It uses explicit matching rules first so that the system decides whenever a safe route can be found.

This matters because the design principle is not:

```txt
ask the model first
```

It is:

```txt
let the system decide first
```

Only when no safe deterministic match is found do we fall back to the LLM.

So the real routing policy is:

```txt
deterministic router runs first
if it finds a confident route, we use that
only if it does not match, we call analyzeMessage
then the LLM chooses a route like pricing, demo_request, human_contact, etc.
```

This is a practical compromise:

- deterministic logic handles obvious cases
- AI handles ambiguity
- the runtime remains the primary controller

---

## The AI Fallback Path

The AI fallback path begins only after deterministic routing fails.

This is implemented in [app/api/chat/route.ts](/c:/Users/Lenovo/Desktop/stateforge/app/api/chat/route.ts) and [src/workflow/analysis/analyzeMessage.ts](/c:/Users/Lenovo/Desktop/stateforge/src/workflow/analysis/analyzeMessage.ts).

What happens in this path:

1. deterministic routing returns `needs_ai_analysis`
2. the runtime persists an `AI_ANALYSIS_STARTED` event
3. the runtime gathers structured context
4. the runtime calls `analyzeMessage(...)`
5. the model returns structured analysis
6. the runtime validates and merges the result
7. the runtime persists the assistant reply and new workflow state

This means the LLM can decide the route, but only inside a bounded, structured fallback path.

The LLM is not deciding:

- whether deterministic routing should run
- whether workflow state should persist
- what the source of truth is
- whether a human review pause exists

Those are runtime decisions.

---

## State Machine + Memory + Context Pattern

SystemForge follows a pattern that is very useful for real-world agent systems:

```txt
state machine + memory + context
```

This is one of the most important architectural ideas in the project.

### State machine

The workflow has explicit steps and statuses such as:

- `message_received`
- `route_resolved`
- `ai_analysis_running`
- `waiting_for_human_review`
- `completed`

This prevents the system from becoming a fuzzy free-form chat loop.

### Memory

The system persists structured memory instead of relying on the model to “remember” prior turns by itself.

### Context

On each AI-needed turn, the runtime reloads the relevant state and passes it back into the model.

So the source of truth becomes:

```txt
workflowState + leadProfile + recentMessages
```

That is the right model for a workflow agent.

---

## Why We Chose Structured Memory

We deliberately did not build “chatbot memory” in the loose sense.

We did not want:

- vague memory summaries
- free-form long-term memory blobs
- model-owned memory

Instead, we used structured workflow memory.

The reasons:

- it is explicit
- it is inspectable
- it is resumable
- it is easier to validate
- it keeps the runtime in control

The memory structure is defined in [src/workflow/memory.ts](/c:/Users/Lenovo/Desktop/stateforge/src/workflow/memory.ts).

It includes:

- `leadProfile`
- `intentSignals`
- `interactionState`
- `qualificationStage`

### leadProfile

Contains structured lead qualification fields such as:

- `goal`
- `useCase`
- `timeline`
- `budget`
- `teamSize`

### intentSignals

Captures intent-level signals such as:

- `wantsPricing`
- `wantsDemo`
- `wantsHumanContact`
- `wantsOnboarding`

### interactionState

Captures process-level state such as:

- whether contact details have already been requested
- which contact fields are still missing
- whether qualification questions have already been asked
- which qualification fields are still missing

This separation is important because not all durable facts belong in the same bucket.

---

## The Context Strategy We Implemented

For AI-needed turns, we follow a very intentional pattern:

1. Store the full conversation in the database.
2. Pass the last 8 messages for context.
3. Pass structured `leadProfile` every time.
4. Pass current `workflowState` every time.

Why this is a good approach:

- the full history is durable
- the AI only gets a compact context window
- the model sees the most relevant recent exchange
- the model also sees structured state, not just raw text

This avoids two bad extremes:

- passing the whole chat every time
- expecting the model to remember everything on its own

In other words:

- the system remembers
- the runtime chooses what context slice to provide
- the AI reasons over that slice

---

## Why We Persist State Beyond Memory

The system does not depend on in-memory application state for workflow continuity.

That is a major architectural choice.

Why we did this:

- in-memory state disappears on refresh or restart
- human review may happen minutes or days later
- workflows should survive beyond a single request
- a durable system must be resumable

This is why workflow data is persisted in the database.

This includes:

- lead records
- lead messages
- workflows
- workflow events
- structured workflow memory

This is what makes resumability after failures possible.

For example:

- the server can restart
- the user can leave the intake page
- a reviewer can approve later
- the workflow can still continue

This is one of the most important differences between a reliable workflow system and a disposable chat UI.

---

## Workflows Are Not Just Messages

One of the core ideas in this project is:

```txt
workflows are not just messages
```

We want to know what the system did, not only what was said.

A plain chat transcript only tells you:

- what the user typed
- what the assistant replied

But a real workflow system also needs to know:

- which route was chosen
- whether deterministic logic was used
- whether AI was called
- whether human review was required
- when approval or rejection happened
- what step the workflow is currently in

That is why SystemForge persists both:

- messages
- workflow state and workflow events

---

## Workflows Table vs Workflow Events Table

This is an important concept to understand and explain clearly.

### `workflows` is the current status card

Think of `workflows` as:

```txt
where this lead is right now
```

It stores the current snapshot of a workflow:

- current step
- current route
- current status
- current qualification stage
- latest structured memory
- latest result

### `workflowEvents` is the audit log

Think of `workflowEvents` as:

```txt
what happened over time
```

It stores the history of transitions and decisions.

Example event stream:

```txt
{ workflowId: "123", eventType: "MESSAGE_RECEIVED", step: "message_received" }
{ workflowId: "123", eventType: "DETERMINISTIC_ROUTE_NOT_FOUND", step: "deterministic_routing" }
{ workflowId: "123", eventType: "AI_ANALYSIS_STARTED", step: "ai_analysis_running" }
{ workflowId: "123", eventType: "AI_ANALYSIS_COMPLETED", step: "waiting_for_human_review" }
```

This is useful because debugging becomes:

- observable workflow execution

instead of:

- guessing what happened

---

## Key Persistence Functions And Why They Matter

Most of the important persistence logic lives in [src/workflow/persistence.ts](/c:/Users/Lenovo/Desktop/stateforge/src/workflow/persistence.ts).

### `getOrCreateWorkflowSession(...)`

What it does:

- if a valid `workflowId` and `leadId` are provided, it resumes that session
- otherwise it creates a new lead and a new workflow

Why it matters:

- it allows the client to continue the same workflow across turns
- it makes the workflow durable instead of one-message-only
- it prevents each message from becoming a separate isolated chat

This function is the foundation of multi-turn continuity.

### `saveWorkflowMessage(...)`

What it does:

- saves a message into `lead_messages`
- updates the workflow’s `lastMessageId`

Why it matters:

- every conversation turn is persisted
- the transcript can be reconstructed later
- the workflow always knows its latest message

### `appendWorkflowEvents(...)`

What it does:

- saves workflow events such as routing, AI analysis start/completion, review-required, approval, rejection, completion

Why we use it:

- to preserve execution history
- to know each state and step the system went through
- to make the workflow observable later

This function exists because workflows are not just about replies. They are about execution.

### `persistDeterministicWorkflowTurn(...)`

What it does:

- saves the user message
- updates lead details if needed
- appends workflow events
- saves the assistant reply
- updates workflow state and structured memory

Why it matters:

- deterministic turns are persisted as one atomic workflow step
- the workflow is durable even for non-AI paths

### `persistAiAnalysisStart(...)`

What it does:

- persists the message and marks the workflow as `ai_analysis_running`

Why it matters:

- the system records that AI analysis began
- the workflow has a real persisted step, not just an in-memory transition

### `persistAiAnalysisCompletion(...)`

What it does:

- saves the assistant reply
- updates lead details
- updates structured memory
- appends AI-related workflow events
- writes final route/current step/status for that turn

Why it matters:

- the AI path becomes durable and inspectable
- the workflow can continue later with real persisted state

---

## How We Avoid Asking For The Same Information Repeatedly

One important reliability feature is that the system does not keep asking for the same contact information once it has already been provided.

This is implemented through:

- lead detail extraction
- lead detail merging
- missing-field computation
- response builders that look at current known state

Relevant code:

- [src/workflow/lead/contactDetails.ts](/c:/Users/Lenovo/Desktop/stateforge/src/workflow/lead/contactDetails.ts)
- [app/api/chat/route.ts](/c:/Users/Lenovo/Desktop/stateforge/app/api/chat/route.ts)
- [src/workflow/responses.ts](/c:/Users/Lenovo/Desktop/stateforge/src/workflow/responses.ts)

How it works:

1. extract lead details from the latest message
2. merge them with the already-known lead details
3. compute which contact fields are still missing
4. generate a response that asks only for missing fields

Example:

- if the user gives name and email
- the system should only ask for phone
- once phone is provided, the system should stop asking for contact details

This improves reliability because the assistant behaves like a state-aware workflow, not a stateless chatbot.

---

## Human-In-The-Loop Approval

Human approval deserves its own architectural section because it is a major part of what makes the system more real-world oriented.

### Why we needed it

Some cases should not be fully completed by the AI or runtime alone.

Examples:

- demo requests
- direct contact requests
- high-intent follow-up
- any case where the system is effectively making a real-world handoff

We do not want the assistant to make operational commitments on its own.

So the system can pause in:

```txt
waiting_for_human_review
```

### How we implemented it

Relevant files:

- [app/api/chat/route.ts](/c:/Users/Lenovo/Desktop/stateforge/app/api/chat/route.ts)
- [src/workflow/persistence.ts](/c:/Users/Lenovo/Desktop/stateforge/src/workflow/persistence.ts)
- [app/reviews/page.tsx](/c:/Users/Lenovo/Desktop/stateforge/app/reviews/page.tsx)
- [app/reviews/[workflowId]/page.tsx](</c:/Users/Lenovo/Desktop/stateforge/app/reviews/[workflowId]/page.tsx>)
- [app/reviews/actions.ts](/c:/Users/Lenovo/Desktop/stateforge/app/reviews/actions.ts)
- [src/workflow/responses.ts](/c:/Users/Lenovo/Desktop/stateforge/src/workflow/responses.ts)

What happens:

1. workflow reaches a review-worthy route such as `human_contact` or `demo_request`
2. once required contact info is complete, the runtime moves the workflow to `waiting_for_human_review`
3. the assistant says the request has been shared for review
4. the review queue shows waiting workflows
5. a reviewer opens the workflow and approves or rejects it
6. the system persists:
   - `HUMAN_APPROVED` or `HUMAN_REJECTED`
   - `WORKFLOW_COMPLETED`
7. the workflow status is updated
8. a final assistant outcome message is stored

This is important because the human decision becomes part of the durable workflow, not just a UI action.

### How approval and rejection worked

The key function is `resolveHumanReview(...)` in [src/workflow/persistence.ts](/c:/Users/Lenovo/Desktop/stateforge/src/workflow/persistence.ts).

It:

- loads the workflow
- writes a final assistant reply
- writes review/completion events
- updates the workflow to `completed` or `rejected`

That is how the workflow truly closes.

---

## How The Client Continues The Same Workflow Across Turns

This is another major architectural piece.

The client is not starting a new chat every time.

It continues the same workflow across turns.

### How this works in normal chat turns

When the chat API succeeds, the response includes:

- `workflowId`
- `leadId`

The intake page stores those in its state and also updates the URL.

That means future messages are sent with:

- `workflowId`
- `leadId`

Then `getOrCreateWorkflowSession(...)` can resume the same workflow.

### Why this matters

Without this, every message would become a separate, isolated request.

With it:

- memory accumulates across turns
- workflow state advances across turns
- the same conversation stays attached to one workflow

That is what makes the system feel stateful and durable.

---

## How Conversation Persistence In The Browser Works

The browser is not the source of truth.

This is a very important point.

The source of truth is:

- the database

The browser only renders the current conversation view.

### URL-driven resume flow

When chat succeeds, [app/intake/page.tsx](/c:/Users/Lenovo/Desktop/stateforge/app/intake/page.tsx) updates the URL to:

```txt
/intake?workflowId=...&leadId=...
```

When the intake page loads, it reads those params with `useSearchParams()`.

If both IDs are present, it calls:

- [app/api/workflows/[workflowId]/route.ts](</c:/Users/Lenovo/Desktop/stateforge/app/api/workflows/[workflowId]/route.ts>)

That route fetches the saved workflow snapshot from the database using:

- `getWorkflowSessionSnapshot(...)`

Then intake restores:

- workflow route
- current step
- workflow status
- the full saved transcript

### Why this approach is good

- the session can survive a page refresh
- the user can leave and come back later
- review approval/rejection can redirect back into the same intake session
- the conversation remains durable because it lives in the database

So the browser does not “remember” the conversation by itself.

Instead:

- the URL identifies the workflow
- the server reloads the saved transcript
- the page hydrates from the server response

That is much stronger than relying on temporary component state alone.

---

## What The README Ideas Mean In Code

The README talks about several ideas that are actually implemented in code now:

### Deterministic routing

Implemented through:

- [src/workflow/routing/deterministic.ts](/c:/Users/Lenovo/Desktop/stateforge/src/workflow/routing/deterministic.ts)

### Durable state

Implemented through:

- `workflows`
- `lead_messages`
- `workflow_events`
- persistence helpers in [src/workflow/persistence.ts](/c:/Users/Lenovo/Desktop/stateforge/src/workflow/persistence.ts)

### Structured memory

Implemented through:

- [src/workflow/memory.ts](/c:/Users/Lenovo/Desktop/stateforge/src/workflow/memory.ts)

### AI fallback with constrained context

Implemented through:

- [src/workflow/analysis/analyzeMessage.ts](/c:/Users/Lenovo/Desktop/stateforge/src/workflow/analysis/analyzeMessage.ts)
- [src/workflow/analysis/schema.ts](/c:/Users/Lenovo/Desktop/stateforge/src/workflow/analysis/schema.ts)
- [src/workflow/analysis/prompt.ts](/c:/Users/Lenovo/Desktop/stateforge/src/workflow/analysis/prompt.ts)

### Human review

Implemented through:

- review queue pages
- review action
- `resolveHumanReview(...)`
- waiting-for-review workflow states

### Resumable intake sessions

Implemented through:

- URL-based session identity
- snapshot API
- intake hydration from server data

---

## Why This Architecture Is Valuable

This architecture is valuable because it shows a different way to think about AI systems.

Instead of:

```txt
prompt in -> answer out
```

it uses:

```txt
stateful workflow execution
```

That means:

- the runtime owns the process
- the model is one decision component
- humans stay in the loop where needed
- state survives beyond one request
- workflows can pause and resume
- execution is observable later

This is much closer to how reliable real-world AI systems should be designed.

---

## Final Mental Model

If you need one compact way to explain SystemForge in an interview, use this:

```txt
SystemForge is a workflow-first AI lead qualification system.
It uses deterministic routing first, structured AI fallback second,
persists workflow state and workflow events in the database,
keeps structured lead memory across turns,
and pauses for human review before high-intent follow-up is finalized.
```

That sentence captures the core architecture.
