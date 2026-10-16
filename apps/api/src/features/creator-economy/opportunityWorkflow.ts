export type OpportunityApplicationStatus = "pending" | "accepted" | "rejected" | "cancelled" | "completed";
export type ApplicationDecision = "accepted" | "rejected" | "cancelled";

export function decideOpportunityApplication(input: {
  status: string;
  action: ApplicationDecision;
  isOwner: boolean;
  isApplicant: boolean;
}): "apply" | "idempotent" | "forbidden" | "conflict" {
  if (input.action === "cancelled") {
    if (!input.isOwner && !input.isApplicant) return "forbidden";
    return input.status === "cancelled"
      ? "idempotent"
      : input.status === "pending" || input.status === "accepted"
        ? "apply"
        : "conflict";
  }
  if (!input.isOwner) return "forbidden";
  if (input.action === "accepted" && (input.status === "accepted" || input.status === "completed")) return "idempotent";
  return input.status === "pending" ? "apply" : "conflict";
}

export function canAccessOpportunityWorkspace(status: string, isOwner: boolean, isApplicant: boolean): boolean {
  return (isOwner || isApplicant) && (status === "accepted" || status === "completed");
}

export function resolveCompletionAction(input: {
  status: string;
  requestedById: number | null;
  actorId: number;
  action: "request" | "confirm";
}): "request" | "complete" | "completed" | "confirmation_required" | "already_requested" | "conflict" {
  if (input.status === "completed") return "completed";
  if (input.status !== "accepted") return "conflict";
  if (input.action === "request") {
    if (input.requestedById === null) return "request";
    return input.requestedById === input.actorId ? "already_requested" : "confirmation_required";
  }
  if (input.requestedById !== null && input.requestedById !== input.actorId) return "complete";
  return "confirmation_required";
}
