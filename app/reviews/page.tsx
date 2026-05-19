import Link from "next/link";
import { listHumanReviewWorkflows } from "@/src/workflow/persistence";

export default async function ReviewsPage() {
  const workflows = await listHumanReviewWorkflows();

  return (
    <main className="relative flex min-h-screen overflow-hidden px-4 py-4 sm:px-6 lg:px-8">
      <div className="noise-overlay" />

      <section className="glass-panel relative mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-6xl flex-col overflow-hidden rounded-4xl">
        <div className="flex items-center justify-between border-b border-(--line) px-5 py-4 sm:px-6">
          <div>
            <p className="eyebrow text-[11px] text-stone-500">Human Review</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-stone-900">
              Manual Human Review
            </h1>
            <p className="mt-2 text-sm text-stone-600">
              Review workflows that are waiting for a human decision before the
              lead can move forward.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/intake"
              className="rounded-full border border-(--line) bg-white/70 px-4 py-2 text-sm text-stone-700 transition hover:bg-white"
            >
              Intake
            </Link>
            <Link
              href="/"
              className="rounded-full border border-(--line) bg-stone-950 px-4 py-2 text-sm text-white transition hover:bg-stone-800"
            >
              Home
            </Link>
          </div>
        </div>

        <div className="grid gap-4 border-b border-(--line) px-5 py-4 sm:grid-cols-3 sm:px-6">
          <MetricCard label="Waiting now" value={String(workflows.length)} />
          <MetricCard
            label="Primary goal"
            value="Approve or reject follow-up"
          />
          <MetricCard label="Source of truth" value="Workflow + events" />
        </div>

        <div className="flex-1 overflow-y-auto p-5 sm:p-6">
          {workflows.length === 0 ? (
            <div className="rounded-3xl border border-(--line) bg-white/75 p-8 text-center">
              <p className="text-lg font-medium text-stone-900">
                No workflows are waiting for review.
              </p>
              <p className="mt-3 text-sm leading-7 text-stone-600">
                When a lead requires a human decision, it will appear here with
                its route, profile, and conversation context.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {workflows.map((workflow) => (
                <Link
                  key={workflow.workflowId}
                  href={`/reviews/${workflow.workflowId}`}
                  className="rounded-3xl border border-(--line) bg-white/78 p-5 transition hover:-translate-y-0.5 hover:bg-white"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="eyebrow text-[10px] text-stone-500">
                        {workflow.route ?? "pending route"}
                      </p>
                      <h2 className="mt-2 text-lg font-medium text-stone-900">
                        {workflow.lead.name ?? "Unnamed lead"}
                      </h2>
                    </div>

                    <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-medium text-stone-700">
                      {workflow.status}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <InfoPill
                      label="Email"
                      value={workflow.lead.email ?? "—"}
                    />
                    <InfoPill
                      label="Phone"
                      value={workflow.lead.phone ?? "—"}
                    />
                    <InfoPill
                      label="Stage"
                      value={workflow.qualificationStage}
                    />
                    <InfoPill label="Step" value={workflow.currentStep} />
                  </div>

                  <div className="mt-4 rounded-2xl border border-(--line) bg-stone-50/85 px-4 py-3">
                    <p className="text-sm leading-6 text-stone-700">
                      Open the workflow to inspect the conversation, memory, and
                      audit trail before deciding.
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
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

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-(--line) bg-stone-50/85 px-3 py-3">
      <p className="eyebrow text-[10px] text-stone-500">{label}</p>
      <p className="mt-2 text-sm text-stone-800">{value}</p>
    </div>
  );
}
