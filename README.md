# SystemForge

A workflow-first AI lead qualification system with deterministic routing, persisted state, and human approval.

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

- accept one inbound lead message
- run deterministic routing first
- avoid AI calls when static routing is enough
- call AI only for high-intent or unclear cases
- validate and store workflow state in the database
- save execution events for auditability
- place AI-qualified leads into a human review step
- approve or reject the lead manually
- log the final workflow outcome

This proves the core idea:

- AI does not control the system
- workflow state is explicit
- human approval is built into the process
- state survives beyond a single request/response
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
-> pricing UI
```

```txt
High-intent sales lead
-> AI analysis
-> human review
```

```txt
Unclear request
-> clarification or AI analysis
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
AI_RESULT_SAVED
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
- execution history
- workflow events

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

# Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js |
| Language | TypeScript |
| AI SDK | Vercel AI SDK |
| Validation | Zod |
| Database | PostgreSQL / Neon |
| ORM | Drizzle |
| UI | Tailwind + shadcn/ui |
| Deployment | Vercel |

---

# How It Can Be Extended

Later, the system can be extended with:

- automatic retry policies
- idempotent action execution
- scheduled resume/recovery jobs
- duplicate event protection
- onboarding or booking actions after approval
- multi-channel lead ingestion
