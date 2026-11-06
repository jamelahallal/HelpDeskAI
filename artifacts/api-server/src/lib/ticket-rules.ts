export type TicketPriority = "P1" | "P2" | "P3" | "P4";
export type TicketStatus = "new" | "assigned" | "in_progress" | "resolved" | "closed";
export type UserRole = "requester" | "agent" | "admin";

export const defaultSlaHours: Record<TicketPriority, number> = {
  P1: 1,
  P2: 4,
  P3: 8,
  P4: 24,
};

const allowedTransitions: Record<TicketStatus, TicketStatus[]> = {
  new: ["assigned"],
  assigned: ["in_progress"],
  in_progress: ["resolved"],
  resolved: ["closed"],
  closed: [],
};

export function createSlaDeadline(createdAt: Date, responseHours: number): Date {
  return new Date(createdAt.getTime() + responseHours * 60 * 60 * 1000);
}

export function calculateSla(
  status: TicketStatus,
  createdAt: Date,
  slaDeadline: Date,
  nowMs = Date.now(),
) {
  if (status === "resolved" || status === "closed") {
    return { slaPercent: 100, slaState: "resolved" as const };
  }

  const elapsed = Math.max(0, nowMs - createdAt.getTime());
  const duration = Math.max(1, slaDeadline.getTime() - createdAt.getTime());
  const slaPercent = Math.max(0, Math.min(100, Math.round((elapsed / duration) * 100)));
  const slaState =
    nowMs >= slaDeadline.getTime()
      ? "breached"
      : slaPercent >= 75
        ? "warning"
        : "on_track";

  return { slaPercent, slaState };
}

export function canReadTicket(input: {
  role: UserRole;
  userId: string;
  requesterId: string;
  assignedAgentId: string | null;
}): boolean {
  if (input.role === "admin") return true;
  if (input.role === "requester") return input.requesterId === input.userId;
  return input.assignedAgentId === null || input.assignedAgentId === input.userId;
}

export function canManageTicket(role: UserRole): boolean {
  return role === "agent" || role === "admin";
}

export function canTransitionTicket(input: {
  role: UserRole;
  userId: string;
  requesterId: string;
  assignedAgentId: string | null;
  currentStatus: TicketStatus;
  nextStatus: TicketStatus;
}): boolean {
  if (input.role === "requester") {
    return input.requesterId === input.userId &&
      input.currentStatus === "resolved" &&
      input.nextStatus === "closed";
  }
  if (
    input.role === "agent" &&
    input.assignedAgentId !== null &&
    input.assignedAgentId !== input.userId
  ) {
    return false;
  }
  if (input.nextStatus === "assigned" && !input.assignedAgentId) return false;
  return allowedTransitions[input.currentStatus].includes(input.nextStatus);
}

export function statusAfterAssignment(
  currentStatus: TicketStatus,
  hasAgent: boolean,
): TicketStatus {
  if (hasAgent && currentStatus === "new") return "assigned";
  if (!hasAgent && currentStatus === "assigned") return "new";
  return currentStatus;
}

/**
 * Who may change a ticket's assignment.
 * Admins can assign to anyone. Agents can only claim an unassigned ticket for
 * themselves or release a ticket they own; they never assign to someone else
 * and never touch a ticket another agent owns.
 */
export function canChangeAssignment(input: {
  role: UserRole;
  userId: string;
  currentAgentId: string | null;
  nextAgentId: string | null;
}): boolean {
  if (input.role === "admin") return true;
  if (input.role !== "agent") return false;
  const ownsOrUnassigned =
    input.currentAgentId === null || input.currentAgentId === input.userId;
  if (!ownsOrUnassigned) return false;
  return input.nextAgentId === input.userId || input.nextAgentId === null;
}
