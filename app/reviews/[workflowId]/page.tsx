import Link from "next/link";
import { notFound } from "next/navigation";
import { submitHumanReview } from "@/app/reviews/actions";
import { getHumanReviewWorkflow } from "@/src/workflow/persistence";

export const dynamic = "force-dynamic";

type ReviewDetailPageProps = {
  params: Promise<{
    workflowId: string;
  }>;
};

export default async function ReviewDetailPage({
  params,
}: ReviewDetailPageProps) {
  const { workflowId } = await params;
  const data = await getHumanReviewWorkflow(workflowId);

  if (!data) {
    notFound();
  }

  const isWaiting = data.workflow.status === "waiting_for_human_review";

  return (
    <main className="relative flex min-h-screen overflow-hidden px-4 py-4 sm:px-6 lg:px-8">
      <div className="noise-overlay" />

      <section className="glass-panel relative mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-7xl flex-col overflow-hidden rounded-4xl">
        <div className="flex items-center justify-between border-b border-(--line) px-5 py-4 sm:px-6">
          <div>
            <p className="eyebrow text-[11px] text-stone-500">Review Detail</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-stone-900">
              Workflow {data.workflow.id.slice(0, 8)}
            </h1>
            <p className="mt-2 text-sm text-stone-600">
              Review the lead context and conversation, then approve or reject
              the follow-up.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/reviews"
              className="rounded-full border border-(--line) bg-white/70 px-4 py-2 text-sm text-stone-700 transition hover:bg-white"
            >
              Back to queue
            </Link>
            <span className="rounded-full bg-(--forest-soft) px-4 py-2 text-sm text-stone-800">
              {data.workflow.status}
            </span>
          </div>
        </div>

        <div className="grid flex-1 gap-6 overflow-y-auto p-5 sm:p-6 lg:grid-cols-[22rem_1fr_22rem]">
          <aside className="space-y-4">
            <Panel title="Lead">
              <ReviewField label="Name" value={data.lead.name ?? "-"} />
              <ReviewField label="Email" value={data.lead.email ?? "-"} />
              <ReviewField label="Phone" value={data.lead.phone ?? "-"} />
              <ReviewField
                label="Business"
                value={data.lead.businessName ?? "-"}
              />
            </Panel>

            <Panel title="Workflow">
              <ReviewField label="Route" value={data.workflow.route ?? "-"} />
              <ReviewField
                label="Stage"
                value={data.workflow.qualificationStage}
              />
              <ReviewField label="Step" value={data.workflow.currentStep} />
              <ReviewField label="Status" value={data.workflow.status} />
            </Panel>
          </aside>

          <section>
            <Panel title="Conversation">
              <div className="space-y-4">
                {data.messages.map((message) => (
                  <article
                    key={message.id}
                    className={`max-w-[88%] rounded-3xl border px-4 py-4 shadow-sm ${
                      message.role === "user"
                        ? "ml-auto border-[rgba(201,111,58,0.22)] bg-[rgba(201,111,58,0.10)]"
                        : "border-[rgba(35,68,58,0.18)] bg-[rgba(35,68,58,0.08)]"
                    }`}
                  >
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-stone-500">
                      {message.role === "user" ? "Lead" : "Assistant"}
                    </p>
                    <p className="mt-3 text-sm leading-7 text-stone-700">
                      {message.content}
                    </p>
                  </article>
                ))}
              </div>
            </Panel>
          </section>

          <aside className="space-y-4">
            <Panel title="Review Decision">
              {isWaiting ? (
                <form action={submitHumanReview} className="space-y-4">
                  <input type="hidden" name="workflowId" value={workflowId} />

                  <label className="block">
                    <span className="eyebrow text-[10px] text-stone-500">
                      Reviewer Note
                    </span>
                    <textarea
                      name="reviewerNote"
                      rows={6}
                      className="mt-3 w-full rounded-2xl border border-(--line) bg-white/85 px-4 py-3 text-sm leading-7 text-stone-800 outline-none"
                      placeholder="Optional note for why you approved or rejected this workflow."
                    />
                  </label>

                  <div className="grid gap-3">
                    <button
                      type="submit"
                      name="decision"
                      value="approved"
                      className="rounded-full bg-stone-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-stone-800"
                    >
                      Approve Follow-Up
                    </button>
                    <button
                      type="submit"
                      name="decision"
                      value="rejected"
                      className="rounded-full border border-(--line-strong) bg-white px-5 py-3 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
                    >
                      Reject Request
                    </button>
                  </div>
                </form>
              ) : (
                <div className="rounded-2xl border border-(--line) bg-stone-50/85 px-4 py-4 text-sm leading-7 text-stone-700">
                  This workflow has already been reviewed. Its final status is{" "}
                  <span className="font-medium text-stone-900">
                    {data.workflow.status}
                  </span>
                  .
                </div>
              )}
            </Panel>
          </aside>
        </div>
      </section>
    </main>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-(--line) bg-white/75 p-5">
      <p className="eyebrow text-[11px] text-stone-500">{title}</p>
      <div className="mt-4 space-y-3">{children}</div>
    </section>
  );
}

function ReviewField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-(--line) bg-stone-50/85 px-4 py-3">
      <p className="eyebrow text-[10px] text-stone-500">{label}</p>
      <p className="mt-2 text-sm text-stone-800">{value}</p>
    </div>
  );
}
