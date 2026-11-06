import type { TicketPriority, UserRole } from "./ticket-rules";

export const SLA_PRIORITIES: readonly TicketPriority[] = ["P1", "P2", "P3", "P4"];
export const MIN_SLA_HOURS = 1;
export const MAX_SLA_HOURS = 720;

/**
 * SLA hours must be whole numbers within range, and a more urgent priority
 * can never be given more time than a less urgent one (P1 <= P2 <= P3 <= P4).
 * Returns an error message, or null when the set of rules is valid.
 */
export function validateSlaHours(hours: Record<TicketPriority, number>): string | null {
  for (const priority of SLA_PRIORITIES) {
    const value = hours[priority];
    if (!Number.isInteger(value) || value < MIN_SLA_HOURS || value > MAX_SLA_HOURS) {
      return `${priority} must be a whole number of hours between ${MIN_SLA_HOURS} and ${MAX_SLA_HOURS}.`;
    }
  }
  for (let i = 1; i < SLA_PRIORITIES.length; i += 1) {
    const urgent = SLA_PRIORITIES[i - 1]!;
    const relaxed = SLA_PRIORITIES[i]!;
    if (hours[urgent] > hours[relaxed]) {
      return `${urgent} cannot allow more time than ${relaxed}. Urgent priorities must have the shorter deadline.`;
    }
  }
  return null;
}

export type UserChangeCheck = {
  actorId: string;
  target: { id: string; role: UserRole; isActive: boolean };
  changes: { role?: UserRole; isActive?: boolean };
  openAssignedTickets: number;
};

/**
 * Guards that stop an admin from locking themselves out or orphaning work.
 * Returns an error message, or null when the change is allowed.
 */
export function userChangeProblem(input: UserChangeCheck): string | null {
  const { actorId, target, changes, openAssignedTickets } = input;

  const changesRole = changes.role !== undefined && changes.role !== target.role;
  const deactivates = changes.isActive === false && target.isActive;

  if (actorId === target.id && (changesRole || deactivates)) {
    return "You can't change your own role or deactivate your own account.";
  }

  const losesStaffAccess =
    (target.role === "agent" || target.role === "admin") &&
    (changes.role === "requester" || deactivates);

  if (losesStaffAccess && openAssignedTickets > 0) {
    const noun = openAssignedTickets === 1 ? "ticket" : "tickets";
    return `This user still has ${openAssignedTickets} open ${noun}. Reassign them first.`;
  }

  return null;
}
