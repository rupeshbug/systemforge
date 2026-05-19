"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { resolveHumanReview } from "@/src/workflow/persistence";

export async function submitHumanReview(formData: FormData) {
  const workflowId = String(formData.get("workflowId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const reviewerNote = String(formData.get("reviewerNote") ?? "");

  if (!workflowId || (decision !== "approved" && decision !== "rejected")) {
    throw new Error("Invalid review submission.");
  }

  const resolved = await resolveHumanReview({
    workflowId,
    decision,
    reviewerNote,
  });

  if (!resolved) {
    throw new Error("Workflow not found.");
  }

  revalidatePath("/reviews");
  revalidatePath(`/reviews/${workflowId}`);
  revalidatePath("/intake");
  redirect(
    `/intake?workflowId=${resolved.workflowId}&leadId=${resolved.leadId}`,
  );
}
