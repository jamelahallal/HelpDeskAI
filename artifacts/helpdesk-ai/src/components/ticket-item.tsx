import { Link } from 'wouter';
import type { Ticket } from '@workspace/api-client-react';
import { PriorityBadge, StatusBadge } from '@/components/common';

export function TicketItem({ ticket }: { ticket: Ticket }) {
  return <Link href={`/tickets/${ticket.id}`} className="ticket-row" data-testid={`link-ticket-${ticket.id}`}>
    <div style={{ minWidth: 0 }}><div className="ticket-id">HD-{ticket.id}</div><div className="ticket-link-title">{ticket.title}</div><div className="ticket-meta">{ticket.requester.fullName} · {ticket.category}</div></div>
    <div><PriorityBadge priority={ticket.priority} /><div style={{ marginTop: 7 }}><StatusBadge status={ticket.status} /></div></div>
    <div className="sla-cell"><div style={{ fontSize: 10, color: '#72818d' }}>SLA {ticket.slaPercent}%</div><div className="sla-track"><div className={`sla-fill ${ticket.slaState}`} style={{ width: `${Math.min(100, Math.max(0, ticket.slaPercent))}%` }} /></div><div className="sla-text">{ticket.slaState === 'breached' ? 'Breached' : ticket.slaState === 'warning' ? 'At risk' : ticket.slaState === 'resolved' ? 'Resolved' : 'On track'}</div></div>
  </Link>;
}
