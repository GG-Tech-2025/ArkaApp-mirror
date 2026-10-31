import type { BranchBillingEvent } from "../services/types";
import { formatDate } from "../utils/dates";

const inr = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

/** One readable line for an entry in the billing history. */
export function describeEvent(e: BranchBillingEvent): string {
  const withNote = (text: string) => (e.note ? `${text} — ${e.note}` : text);
  switch (e.eventType) {
    case "CREATED":
      return `Branch added${e.renewalDateAfter ? `, first renewal ${formatDate(e.renewalDateAfter)}` : ""}`;
    case "PAYMENT": {
      const parts = [`Payment received${e.amount !== null ? ` ${inr(e.amount)}` : ""}`];
      if (e.reference) parts.push(`ref ${e.reference}`);
      if (e.renewalDateAfter) parts.push(`renewal moved to ${formatDate(e.renewalDateAfter)}`);
      return withNote(parts.join(", "));
    }
    case "PAUSED":
      return withNote("Branch paused");
    case "RESUMED":
      return withNote("Branch resumed");
    case "RENEWAL_CHANGED":
      return withNote(`Renewal date changed to ${formatDate(e.renewalDateAfter)}`);
    case "ORG_PAUSED":
      return withNote("Client suspended");
    case "ORG_RESUMED":
      return withNote("Client resumed");
    default:
      return e.eventType;
  }
}
