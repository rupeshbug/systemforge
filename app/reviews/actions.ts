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

  await resolveHumanReview({
    workflowId,
    decision,
    reviewerNote,
  });

  revalidatePath("/reviews");
  revalidatePath(`/reviews/${workflowId}`);
  redirect(`/reviews/${workflowId}`);
}
