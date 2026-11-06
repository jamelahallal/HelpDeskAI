import type { TicketPriority, TicketStatus } from '@workspace/api-client-react';

export const statusText: Record<TicketStatus, string> = { new: 'New', assigned: 'Assigned', in_progress: 'In progress', resolved: 'Resolved', closed: 'Closed' };
export const priorities: TicketPriority[] = ['P1', 'P2', 'P3', 'P4'];
export const statuses: TicketStatus[] = ['new', 'assigned', 'in_progress', 'resolved', 'closed'];
