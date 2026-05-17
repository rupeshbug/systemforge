import Link from "next/link";

const starterPrompts = [
  "I want to book a demo for my company.",
  "We need pricing help but are not sure which plan fits.",
  "Can someone from sales contact me tomorrow?",
];

const statusItems = [
  { label: "Current route", value: "pending" },
  { label: "Current step", value: "message_received" },
];

export default function IntakePage() {
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
          {statusItems.map((item) => (
            <MetricCard
              key={item.label}
              label={item.label}
              value={item.value}
            />
          ))}
        </div>

        <div className="grid flex-1 gap-6 overflow-hidden p-5 sm:p-6 lg:grid-cols-[1fr_20rem]">
          <div className="flex min-h-0 flex-col rounded-[1.75rem] border border-(--line) bg-white/55 p-5">
            <div>
              <p className="eyebrow text-[11px] text-stone-500">
                New Lead Message
              </p>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
                Start a lead qualification flow with the first message from a
                prospective customer.
              </p>
            </div>

            <textarea
              rows={10}
              defaultValue="Hi, we're comparing tools for our revops team and want to schedule a demo."
              className="mt-5 min-h-0 flex-1 resize-none rounded-3xl border border-(--line) bg-white/90 px-4 py-4 text-sm leading-7 text-stone-800 outline-none placeholder:text-stone-400"
            />

            <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <button className="rounded-full bg-stone-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-stone-800">
                Submit Message
              </button>

              <div className="text-sm text-stone-500">
                The active workflow will be created or resumed after submission.
              </div>
            </div>
          </div>

          <aside className="flex min-h-0 flex-col gap-4">
            <div className="rounded-3xl border border-(--line) bg-stone-950 p-5 text-stone-100">
              <p className="eyebrow text-[11px] text-stone-400">
                Suggested Prompts
              </p>
              <div className="mt-4 space-y-3">
                {starterPrompts.map((prompt) => (
                  <div
                    key={prompt}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm leading-6 text-stone-200"
                  >
                    {prompt}
                  </div>
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
