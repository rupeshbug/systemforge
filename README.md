# SystemForge

A workflow-first AI lead qualification system with deterministic routing, structured memory, durable state, and human review.

SystemForge explores how AI systems can be built beyond simple prompt-response chatbots. Instead of letting the LLM control the entire application, the system treats AI as one step inside a controlled workflow runtime.

---

# Core Philosophy

```txt
AI suggests.
Runtime decides.
Human approves when needed.
Workflow history persists everything.
```

The goal is to build reliable AI workflows with:

- deterministic routing
- structured outputs
- structured workflow memory
- workflow state machines
- human-in-the-loop approval
- execution history
- durable state persistence
- auditability and tracing

---

# Primary Use Case

## AI Lead Qualification Review System

Businesses receive inbound leads through:

- website chat
- WhatsApp
- Messenger
- forms

SystemForge helps businesses:

- understand lead intent
- qualify leads
- collect missing information
- escalate uncertain or high-intent leads to humans
- record the final reviewed outcome

Example messages:

```txt
I want to book a demo for my company.
```

```txt
We are interested in pricing but unsure which plan fits us.
```

```txt
Can someone from sales contact me?
```

---

# What This Project Implements

This project focuses on a narrow but complete workflow slice:

- accept inbound lead conversations across multiple turns
- run deterministic routing first
- avoid AI calls when static routing is enough
- call AI only when deterministic logic is not enough
- validate and store workflow state in the database
- persist structured lead memory and qualification context
- save execution events for auditability
- place review-worthy leads into a human review step
- approve or reject the lead manually through a review UI
- resume the same intake session after review
- log the final workflow outcome

This proves the core idea:

- AI does not control the system
- workflow state is explicit
- human approval is built into the process
- state survives beyond a single request/response
- lead context survives across turns
- workflow decisions are observable later

---

# Deterministic Routing

The runtime avoids unnecessary AI calls whenever deterministic logic is enough.

Examples:

```txt
Greeting
-> static reply
-> no AI call
```

```txt
Pricing question
-> static pricing response
-> collect missing contact information
```

```txt
Direct team handoff request
-> collect required contact information
-> human review
```

```txt
Unclear or multi-meaning request
-> AI analysis
-> clarification or next workflow step
```

```txt
Irrelevant message
-> safe fallback
```

This proves an important idea:

> The LLM is not controlling the system. The workflow runtime is.

---

# Workflow-First Architecture

Instead of thinking:

```txt
request -> response
```

SystemForge thinks in:

```txt
stateful workflows
```

Example workflow:

```txt
MESSAGE_RECEIVED
|
DETERMINISTIC_ROUTING
|
ROUTE_DECIDED
|
AI_ANALYSIS_RUNNING (only when needed)
|
AI_RESULT_SAVED / STATIC_RESPONSE_SAVED
|
WAITING_FOR_HUMAN_REVIEW
|
APPROVED / REJECTED
|
COMPLETED
```

Each workflow moves through explicit states.

This makes the system:

- easier to reason about
- easier to debug
- resumable from persisted state
- observable over time
- safer than free-form AI control

---

# Durable Workflow Thinking

The system stores workflow state and history in the database so the process does not depend on in-memory application state.

This means workflows can survive:

- server crashes
- deployment restarts
- delayed human review
- temporary AI/API failures

Example:

```txt
WAITING_FOR_HUMAN_REVIEW
```

A human might approve:

- 5 minutes later
- 2 days later
- 2 weeks later

The workflow should still be resumable because its state is persisted.

To support this, the runtime stores:

- workflow state
- structured lead memory
- execution history
- workflow events

---

# Structured Memory And Context

The system does not rely on the model to "remember" prior turns by itself.

Instead, the runtime persists and reloads structured workflow context such as:

- lead contact details
- intent signals like pricing, demo, or human-contact interest
- qualification fields like use case, timeline, budget, and team size
- interaction state like which contact fields are still missing

For every AI-needed turn, the runtime loads:

- current workflow state
- current structured memory
- recent conversation messages

Then it asks the model for a constrained update and merges the result back into persisted state.

This keeps memory:

- explicit
- inspectable
- resumable
- runtime-controlled

---

# Execution History

Every important workflow step is saved.

Example events:

```txt
WORKFLOW_STARTED
ROUTE_DECIDED
AI_ANALYSIS_COMPLETED
HUMAN_REVIEW_REQUIRED
HUMAN_APPROVED
WORKFLOW_COMPLETED
```

This creates:

- auditability
- observability
- debugging visibility

Without execution history:

```txt
debugging = guessing
```

With execution history:

```txt
debugging = observable workflow execution
```

---

# Human Review Loop

SystemForge includes a manual review queue for workflows that should not continue automatically.

Typical examples include:

- demo requests
- direct team contact requests
- high-intent handoff cases

The flow works like this:

```txt
Lead asks for follow-up
-> workflow collects required contact details
-> workflow enters WAITING_FOR_HUMAN_REVIEW
-> reviewer approves or rejects
-> final outcome is saved
-> the intake session resumes with the review result visible
```

This matters because the assistant does not make real-world commitments on its own.

---

# Resumable Intake Sessions

The intake workspace is resumable.

When a conversation creates or resumes a workflow, the runtime returns:

- `workflowId`
- `leadId`

The intake page stores those identifiers in the URL and reloads the saved transcript from the database when the page is revisited.

This makes it possible to:

- leave the intake page
- review the workflow later
- approve or reject it
- return to intake and see the same conversation plus the final review outcome

---

# Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js |
| Language | TypeScript |
| AI SDK | Vercel AI SDK |
| Validation | Zod |
| Database | PostgreSQL / Neon |
| ORM | Drizzle |
| UI | Tailwind CSS |
| Deployment | Vercel |

---

# How It Can Be Extended

Later, the system can be extended with:

- stronger auth and access control around lead data
- signed session tokens instead of raw IDs in the URL
- automated tests for routing, persistence, and review flows
- automatic retry policies
- idempotent action execution
- scheduled resume/recovery jobs
- duplicate event protection
- onboarding or booking actions after approval
- multi-channel lead ingestion
- Temporal or another workflow engine for longer-running orchestration
