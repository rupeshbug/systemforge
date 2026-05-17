import Link from "next/link";

const features = [
  {
    label: "Deterministic routing",
    detail: "Resolve obvious cases without paying the AI tax.",
    tone: "accent" as const,
  },
  {
    label: "Durable workflows",
    detail: "Persist state so lead qualification can resume safely.",
    tone: "forest" as const,
  },
  {
    label: "Human review",
    detail: "Approve high-intent or uncertain leads before action.",
    tone: "neutral" as const,
  },
];

const capabilityCards = [
  {
    title: "Stateful execution",
    text: "Messages do not disappear into a chat transcript. They move through explicit workflow states.",
  },
  {
    title: "Audit trail",
    text: "Every important transition can be recorded as an event for debugging and review.",
  },
  {
    title: "Selective AI",
    text: "Use the model only when deterministic logic is not enough.",
  },
];

export default function Home() {
  return (
    <main className="relative flex min-h-screen items-center overflow-hidden px-4 py-4 sm:px-6 lg:px-8">
      <div className="noise-overlay" />

      <section className="glass-panel relative mx-auto flex h-[calc(100vh-2rem)] max-h-215 w-full max-w-6xl flex-col overflow-hidden rounded-4xl lg:grid lg:grid-cols-[1.1fr_0.9fr]">
        <div className="absolute inset-x-0 top-0 h-28 bg-linear-to-r from-[rgba(201,111,58,0.16)] via-transparent to-[rgba(35,68,58,0.14)]" />

        <div className="relative flex h-full flex-col justify-between gap-6 p-6 sm:p-8 lg:p-10">
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="eyebrow text-[11px] text-stone-500">
                  SystemForge
                </p>
                <p className="mt-2 max-w-md text-sm leading-6 text-stone-600">
                  Workflow-first AI lead qualification with durable state and
                  explicit routing.
                </p>
              </div>

              <div className="rounded-full border border-(--line) bg-white/60 px-3 py-2 text-xs text-stone-700 shadow-sm">
                MVP
              </div>
            </div>

            <div className="space-y-4">
              <h1 className="max-w-2xl text-3xl font-semibold tracking-[-0.04em] text-stone-900 sm:text-5xl lg:text-4xl">
                Build lead workflows,
                <br />
                not just AI replies.
              </h1>

              <p className="max-w-xl text-base leading-7 text-stone-700 sm:text-lg">
                SystemForge treats AI as one part of a controlled runtime. The
                goal is a reliable lead intake flow that can route, persist,
                pause, and resume.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {features.map((feature) => (
                <InfoCard
                  key={feature.label}
                  label={feature.label}
                  value={feature.detail}
                  tone={feature.tone}
                />
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-(--line) bg-white/70 p-5">
            <p className="eyebrow text-[11px] text-stone-500">
              What This App Focuses On
            </p>
            <div className="mt-4 grid gap-3 lg:grid-cols-3">
              {capabilityCards.map((card) => (
                <div
                  key={card.title}
                  className="rounded-[1.25rem] border border-(--line) bg-stone-50/85 p-4"
                >
                  <p className="text-sm font-medium text-stone-900">
                    {card.title}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-stone-600">
                    {card.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="relative flex h-full flex-col border-t border-(--line) bg-stone-950 px-6 py-6 text-stone-100 sm:px-8 sm:py-8 lg:border-l lg:border-t-0 lg:px-10 lg:py-10">
          <div>
            <p className="eyebrow text-[11px] text-stone-400">Try The Flow</p>
            <h2 className="mt-3 max-w-sm text-3xl font-semibold tracking-[-0.04em] text-white">
              Open the lead intake workspace.
            </h2>
            <p className="mt-4 max-w-md text-sm leading-7 text-stone-300">
              Explore the intake experience in a dedicated workspace built for
              submitting, routing, and reviewing inbound leads.
            </p>
          </div>

          <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5">
            <div className="space-y-3">
              <PreviewRow label="Input" value="Lead message" />
              <PreviewRow label="Route" value="deterministic first" />
              <PreviewRow label="AI step" value="only when needed" />
              <PreviewRow label="Outcome" value="saved workflow state" />
            </div>

            <Link
              href="/intake"
              className="mt-6 inline-flex items-center justify-center rounded-full bg-(--accent) px-5 py-3 text-sm font-medium text-white shadow-[0_16px_32px_rgba(201,111,58,0.28)] transition hover:-translate-y-0.5 hover:brightness-95"
            >
              Try The Interface
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

function InfoCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "accent" | "forest" | "neutral";
}) {
  const toneClasses =
    tone === "accent"
      ? "bg-[var(--accent-soft)]"
      : tone === "forest"
        ? "bg-[var(--forest-soft)]"
        : "bg-white/75";

  return (
    <div
      className={`rounded-[1.35rem] border border-(--line) p-4 ${toneClasses}`}
    >
      <p className="eyebrow text-[10px] text-stone-500">{label}</p>
      <p className="mt-3 text-sm leading-6 text-stone-700">{value}</p>
    </div>
  );
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
      <span className="eyebrow text-[10px] text-stone-400">{label}</span>
      <span className="text-sm text-stone-200">{value}</span>
    </div>
  );
}
