import type { ContactField } from "@/src/workflow/analysis/schema";

export type KnownLeadDetails = {
  name: string | null;
  businessName: string | null;
  email: string | null;
  phone: string | null;
};

export const CONTACT_FIELD_LABELS: Record<ContactField, string> = {
  name: "name",
  businessName: "business name",
  email: "email",
  phone: "phone number",
};

export function getMissingContactFields(
  lead: KnownLeadDetails | null | undefined,
): ContactField[] {
  const details = lead ?? {
    name: null,
    businessName: null,
    email: null,
    phone: null,
  };

  const missingFields: ContactField[] = [];

  if (!details.name?.trim()) {
    missingFields.push("name");
  }

  if (!details.email?.trim()) {
    missingFields.push("email");
  }

  if (!details.phone?.trim()) {
    missingFields.push("phone");
  }

  return missingFields;
}

export function formatContactFieldList(fields: ContactField[]) {
  const labels = fields.map((field) => CONTACT_FIELD_LABELS[field]);

  if (labels.length === 0) {
    return "";
  }

  if (labels.length === 1) {
    return labels[0];
  }

  if (labels.length === 2) {
    return `${labels[0]} and ${labels[1]}`;
  }

  return `${labels.slice(0, -1).join(", ")}, and ${labels.at(-1)}`;
}

export function mergeLeadDetails(
  base: KnownLeadDetails | null | undefined,
  incoming: Partial<KnownLeadDetails>,
): KnownLeadDetails {
  return {
    name: incoming.name?.trim() || base?.name || null,
    businessName:
      incoming.businessName?.trim() || base?.businessName || null,
    email: incoming.email?.trim() || base?.email || null,
    phone: incoming.phone?.trim() || base?.phone || null,
  };
}

export function extractLeadDetailsFromMessage(message: string) {
  const trimmedMessage = message.trim();

  const emailMatch = trimmedMessage.match(
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  );

  const phoneMatch = trimmedMessage.match(
    /(?:\+?\d[\d\s().-]{7,}\d)/,
  );

  const namePatterns = [
    /(?:my name is|i am|i'm)\s+([a-z][a-z]+(?:\s+[a-z][a-z]+){0,2})/i,
  ];

  const companyPatterns = [
    /(?:company|business|organization)\s*(?:name)?\s*(?:is|:)\s+([a-z0-9&.,'\- ]{2,})/i,
    /(?:i am|i'm)\s+from\s+([a-z0-9&.,'\- ]{2,})/i,
  ];

  const name = findFirstMatch(namePatterns, trimmedMessage);
  const businessName = findFirstMatch(companyPatterns, trimmedMessage);

  return {
    name: sanitizeExtractedValue(name),
    businessName: sanitizeExtractedValue(businessName),
    email: emailMatch?.[0]?.trim() ?? null,
    phone: phoneMatch?.[0]?.trim() ?? null,
  };
}

function findFirstMatch(patterns: RegExp[], message: string) {
  for (const pattern of patterns) {
    const match = message.match(pattern);

    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}

function sanitizeExtractedValue(value: string | null) {
  if (!value) {
    return null;
  }

  return value.trim().replace(/[.,!?]+$/, "");
}
