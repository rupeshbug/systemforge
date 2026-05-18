"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const starterPrompts = [
  "I want to book a demo for my company.",
  "We need pricing help but are not sure which plan fits.",
  "Can someone from sales contact me tomorrow?",
];

const statusItems = [
  { label: "Current route", value: "pending" },
  { label: "Current step", value: "message_received" },
];

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

export default function IntakePage() {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [leadId, setLeadId] = useState<string | null>(null);
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  const [workflowStatus, setWorkflowStatus] = useState(statusItems);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Welcome to SystemForge. Share the lead's message and I will respond as the qualification assistant.",
    },
  ]);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = scrollRef.current;

    if (!container) {
      return;
    }

    container.scrollTo({
      top: container.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, isSubmitting]);

  async function handleSubmit() {
    const trimmedMessage = message.trim();

    if (!trimmedMessage) {
      setError("Please enter a message first.");
      return;
    }

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmedMessage,
    };

    setMessages((current) => [...current, userMessage]);
    setMessage("");
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: trimmedMessage,
          leadId: leadId ?? undefined,
          workflowId: workflowId ?? undefined,
        }),
      });

      const data = (await response.json()) as {
        ok: boolean;
        text?: string;
        error?: string;
        code?: string;
        route?: string;
        currentStep?: string;
        leadId?: string;
        workflowId?: string;
      };

      if (!response.ok || !data.ok) {
        if (data.code === "workflow_session_not_found") {
          setLeadId(null);
          setWorkflowId(null);
        }
        setError(data.error ?? "Something went wrong.");
        return;
      }

      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: data.text ?? "",
        },
      ]);
      setLeadId(data.leadId ?? null);
      setWorkflowId(data.workflowId ?? null);
      setWorkflowStatus([
        { label: "Current route", value: data.route ?? "pending" },
        {
          label: "Current step",
          value: data.currentStep ?? "message_received",
        },
      ]);
    } catch {
      setError("Unable to reach the chat API.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSubmit();
    }
  }

  return (
    <main className="relative flex min-h-screen items-center overflow-hidden px-4 py-4 sm:px-6 lg:px-8">
      <div className="noise-overlay" />

      <section className="glass-panel relative mx-auto flex h-[calc(100vh-2rem)] w-full max-w-5xl flex-col overflow-hidden rounded-4xl">
        <div className="flex items-center justify-between border-b border-(--line) px-5 py-4 sm:px-6">
          <div>
            <p className="eyebrow text-[11px] text-stone-500">Lead Intake</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-stone-900">
              Sales qualification console
            </h1>
          </div>

          <Link
            href="/"
            className="rounded-full border border-(--line) bg-white/70 px-4 py-2 text-sm text-stone-700 transition hover:bg-white"
          >
            Back
          </Link>
        </div>

        <div className="grid gap-4 border-b border-(--line) px-5 py-4 sm:grid-cols-2 sm:px-6">
          {workflowStatus.map((item) => (
            <MetricCard
              key={item.label}
              label={item.label}
              value={item.value}
            />
          ))}
        </div>

        <div className="grid flex-1 gap-6 overflow-hidden p-5 sm:p-6 lg:grid-cols-[1fr_20rem]">
          <div className="flex min-h-0 flex-col rounded-[1.75rem] border border-(--line) bg-white/55">
            <div
              ref={scrollRef}
              className="flex-1 space-y-4 overflow-y-auto px-5 py-5"
            >
              {messages.map((entry) => (
                <article
                  key={entry.id}
                  className={`max-w-[85%] rounded-3xl border px-4 py-4 shadow-sm ${
                    entry.role === "user"
                      ? "ml-auto border-[rgba(201,111,58,0.22)] bg-[rgba(201,111,58,0.10)]"
                      : "border-[rgba(35,68,58,0.18)] bg-[rgba(35,68,58,0.08)]"
                  }`}
                >
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-stone-500">
                    {entry.role === "user" ? "Lead" : "Assistant"}
                  </p>
                  <p className="mt-3 text-sm leading-7 text-stone-700">
                    {entry.content}
                  </p>
                </article>
              ))}

              {isSubmitting && (
                <article className="max-w-[85%] rounded-3xl border border-[rgba(35,68,58,0.18)] bg-[rgba(35,68,58,0.08)] px-4 py-4 shadow-sm">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-stone-500">
                    Assistant
                  </p>
                  <p className="mt-3 text-sm leading-7 text-stone-500">
                    Thinking...
                  </p>
                </article>
              )}
            </div>

            <div className="border-t border-(--line) p-5">
              <div className="rounded-3xl border border-(--line) bg-white/85 p-3">
                <textarea
                  rows={4}
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type the lead's message..."
                  className="w-full resize-none bg-transparent px-2 py-2 text-sm leading-7 text-stone-800 outline-none placeholder:text-stone-400"
                />

                <div className="mt-3 flex flex-col gap-3 border-t border-(--line) pt-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-stone-500">
                    The active workflow will be created or resumed after
                    submission.
                  </p>

                  <button
                    type="button"
                    onClick={() => void handleSubmit()}
                    disabled={isSubmitting}
                    className="rounded-full bg-stone-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSubmitting ? "Sending..." : "Send Message"}
                  </button>
                </div>
              </div>

              {error && (
                <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {error}
                </div>
              )}
            </div>
          </div>

          <aside className="flex min-h-0 flex-col gap-4">
            <div className="rounded-3xl border border-(--line) bg-stone-950 p-5 text-stone-100">
              <p className="eyebrow text-[11px] text-stone-400">
                Suggested Prompts
              </p>
              <div className="mt-4 space-y-3">
                {starterPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => setMessage(prompt)}
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm leading-6 text-stone-200 transition hover:bg-white/10"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-(--line) bg-white/70 p-5">
              <p className="eyebrow text-[11px] text-stone-500">
                What Happens Next
              </p>
              <div className="mt-4 space-y-3">
                <StepRow number="01" text="Save the inbound message" />
                <StepRow number="02" text="Find or reuse the active workflow" />
                <StepRow
                  number="03"
                  text="Run routing and record workflow events"
                />
              </div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.25rem] border border-(--line) bg-white/65 px-4 py-3">
      <p className="eyebrow text-[10px] text-stone-500">{label}</p>
      <p className="mt-2 text-sm font-medium text-stone-900">{value}</p>
    </div>
  );
}

function StepRow({ number, text }: { number: string; text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-(--line) bg-stone-50/85 px-4 py-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-900 text-xs font-medium text-white">
        {number}
      </div>
      <p className="text-sm text-stone-700">{text}</p>
    </div>
  );
}
