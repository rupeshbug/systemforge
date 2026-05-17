# SystemForge

A durable AI workflow system for deterministic, auditable, and human-approved lead qualification.

SystemForge explores how AI systems can be engineered beyond simple prompt-response chatbots. Instead of letting the LLM control the entire application, the system treats AI as one component inside a controlled workflow runtime.

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
- retry and failure handling
- pause/resume workflows
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

The runtime helps businesses:

- understand lead intent
- qualify leads
- collect missing information
- trigger onboarding/demo workflows
- escalate uncertain leads to humans
- safely execute business actions

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

# Deterministic Routing

The runtime avoids unnecessary AI calls whenever deterministic logic is enough.

Examples:

```txt
Greeting
→ static reply
→ no AI call
```

```txt
Pricing question
→ static pricing response
→ pricing UI
```

```txt
Onboarding request
→ onboarding UI
```

```txt
High-intent sales lead
→ AI analysis
→ human review
```

```txt
Unclear request
→ clarification flow
```

```txt
Irrelevant message
→ safe fallback
```

This proves an important idea:

> The LLM is not controlling the system. The workflow runtime is.

---

# Workflow-First Architecture

Instead of thinking:

```txt
request → response
```

SystemForge thinks in:

```txt
stateful long-running workflows
```

Example workflow:

```txt
MESSAGE_RECEIVED
↓
DETERMINISTIC_ROUTING
↓
AI_ANALYSIS_RUNNING
↓
VALIDATION_PASSED
↓
WAITING_FOR_HUMAN_REVIEW
↓
APPROVED
↓
ACTION_EXECUTED
↓
COMPLETED
```

Each workflow moves through explicit states.

This makes the system:

- easier to reason about
- easier to debug
- safer to recover
- observable over time
- resilient to failures

---

# Durable Workflow Thinking

The project is inspired by Temporal-style workflow thinking.

Workflows should survive:

- API failures
- server crashes
- deployment restarts
- delayed user replies
- retries
- duplicate events

Example:

```txt
WAITING_FOR_HUMAN_REVIEW
```

A human might approve:
- 5 minutes later
- 2 days later
- 2 weeks later

The workflow should still resume safely.

To support this, the runtime persists:

- workflow state
- execution history
- retry information
- workflow events

---

# Execution History

Every important workflow step is saved.

Example events:

```txt
WORKFLOW_STARTED
AI_ANALYSIS_COMPLETED
HUMAN_REVIEW_REQUIRED
HUMAN_APPROVED
ACTION_EXECUTED
WORKFLOW_COMPLETED
```

This creates:

- auditability
- observability
- replayability
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

# Retry and Failure Handling

AI systems fail constantly.

Possible failures:

- LLM timeout
- invalid JSON output
- API failure
- database failure
- duplicate webhook events

The runtime supports:

- retries
- fallback paths
- validation before execution
- safe workflow recovery
- human escalation

The goal is not to assume AI always works.

The goal is to build systems that fail safely.

---

# Idempotent Workflow Thinking

Retries should never create duplicate side effects.

Example actions:

```txt
create_follow_up_task
send_notification
create_booking
```

The runtime checks whether an action has already executed before retrying.

This prevents:

- duplicate tasks
- duplicate bookings
- repeated notifications

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

# What This Project Demonstrates

SystemForge demonstrates:

- workflow orchestration
- deterministic AI routing
- durable workflow thinking
- workflow state machines
- human-in-the-loop systems
- structured outputs
- failure-aware AI systems
- idempotent execution
- auditability and tracing
- runtime engineering

Most AI projects demonstrate prompting.

SystemForge demonstrates:

# engineering around AI systems.

---

# Engineering Philosophy

> Use AI for reasoning, but use software engineering for control.

The goal is not autonomous AI.

The goal is reliable, observable, recoverable, and controllable AI workflows built with explicit orchestration and durable state management.
