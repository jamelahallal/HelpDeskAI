import { useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { FilePlus2, Search, X } from 'lucide-react';
import { useListTickets } from '@workspace/api-client-react';
import type { TicketPriority, TicketStatus } from '@workspace/api-client-react';
import { Empty, LoadRows, PriorityBadge, Problem, StatusBadge } from '@/components/common';
import { TicketCreate } from '@/components/ticket-create';
import { ago } from '@/lib/format';
import { priorities, statuses, statusText } from '@/lib/ticket-constants';

export function TicketsPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const params = useMemo(() => ({ limit: 100, ...(search.trim() ? { search: search.trim() } : {}), ...(status ? { status: status as TicketStatus } : {}), ...(priority ? { priority: priority as TicketPriority } : {}) }), [search, status, priority]);
  const tickets = useListTickets(params);
  const [createOpen, setCreateOpen] = useState(false);
  const [, navigate] = useLocation();
  return <div className="content fade-in">
    <div className="page-heading"><div><div className="eyebrow">SERVICE DESK / TICKETS</div><h1 className="page-title">Ticket queue</h1><p className="page-subtitle">Find the request. See its owner, priority, and service clock.</p></div><button className="btn btn-primary" onClick={() => setCreateOpen(true)} data-testid="button-create-ticket"><FilePlus2 size={15} />New request</button></div>
    <div className="toolbar">
      <div className="search-wrap"><Search size={15} /><input className="field" type="search" placeholder="Search requests…" aria-label="Search tickets" value={search} onChange={(e) => setSearch(e.target.value)} data-testid="input-search-tickets" /></div>
      <select className="select" aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)} data-testid="select-filter-status"><option value="">All statuses</option>{statuses.map((item) => <option key={item} value={item}>{statusText[item]}</option>)}</select>
      <select className="select" aria-label="Filter by priority" value={priority} onChange={(e) => setPriority(e.target.value)} data-testid="select-filter-priority"><option value="">All priorities</option>{priorities.map((item) => <option key={item} value={item}>{item}</option>)}</select>
      {(search || status || priority) && <button className="btn btn-small" onClick={() => { setSearch(''); setStatus(''); setPriority(''); }} data-testid="button-clear-filters"><X size={13} />Clear</button>}
    </div>
    <section className="panel">
      <div className="panel-head"><div><div className="panel-title">All requests</div><div className="panel-kicker">{tickets.data?.length ?? '—'} tickets in this view</div></div><span className="live-label">Queue live</span></div>
      {tickets.isLoading ? <LoadRows /> : tickets.isError ? <Problem retry={() => tickets.refetch()} text="Ticket data could not be reached. Your filters are still here." /> : !tickets.data?.length ? <Empty title={search || status || priority ? 'No matching requests' : 'No tickets in the queue'} detail={search || status || priority ? 'Try changing a filter or search term.' : 'Start with a support request and it will be tracked here.'} action={search || status || priority ? <button className="btn btn-small" onClick={() => { setSearch(''); setStatus(''); setPriority(''); }} data-testid="button-empty-clear">Clear filters</button> : <button className="btn btn-primary btn-small" onClick={() => setCreateOpen(true)} data-testid="button-empty-create">Create a request</button>} /> : <div className="table-wrap"><table className="ticket-table ticket-cards"><thead><tr><th>Request</th><th>Status</th><th>Priority</th><th>Requester</th><th>Assigned to</th><th>Last updated</th></tr></thead><tbody>{tickets.data.map((ticket) => <tr key={ticket.id} data-testid={`row-ticket-${ticket.id}`} onClick={() => navigate(`/tickets/${ticket.id}`)} style={{ cursor: 'pointer' }}><td><div className="ticket-name">{ticket.title}</div><div className="ticket-sub">HD-{ticket.id} · {ticket.category}</div></td><td><StatusBadge status={ticket.status} /></td><td><PriorityBadge priority={ticket.priority} /></td><td>{ticket.requester.fullName}</td><td>{ticket.assignedAgent?.fullName || <span style={{ color: '#9aa5ac' }}>Unassigned</span>}</td><td style={{ color: '#73828d' }}>{ago(ticket.updatedAt)}</td></tr>)}</tbody></table></div>}
    </section>
    {createOpen && <TicketCreate close={() => setCreateOpen(false)} onCreated={(ticket) => { setCreateOpen(false); navigate(`/tickets/${ticket.id}`); }} />}
  </div>;
}
