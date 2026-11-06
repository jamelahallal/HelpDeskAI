import { useMemo, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Activity, ArrowRight, ArrowUpRight, Clock3, FilePlus2, Filter, Ticket as TicketIcon } from 'lucide-react';
import { useGetDashboardSummary, useListTickets } from '@workspace/api-client-react';
import type { User } from '@workspace/api-client-react';
import { Empty, LoadRows, PriorityBadge, Problem } from '@/components/common';
import { TicketCreate } from '@/components/ticket-create';
import { TicketItem } from '@/components/ticket-item';

export function Dashboard({ user }: { user: User }) {
  const summary = useGetDashboardSummary();
  const params = useMemo(() => ({ limit: 8 }), []);
  const tickets = useListTickets(params);
  const [showCreate, setShowCreate] = useState(false);
  const [, navigate] = useLocation();
  const ordered = [...(tickets.data || [])].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  const metricData = summary.data ? [
    { label: user.role === 'requester' ? 'My requests' : 'All requests', value: summary.data.total, foot: 'Across the service desk', icon: TicketIcon },
    { label: 'Open', value: summary.data.open, foot: 'Awaiting ownership', icon: Activity },
    { label: 'In progress', value: summary.data.inProgress, foot: 'Being actively worked', icon: ArrowUpRight },
    { label: 'SLA attention', value: summary.data.slaWarning + summary.data.slaBreached, foot: `${summary.data.slaBreached} breached · ${summary.data.slaWarning} at risk`, icon: Clock3 },
  ] : [];
  return <div className="content fade-in">
    <div className="page-heading"><div><div className="eyebrow">SERVICE DESK / OVERVIEW</div><h1 className="page-title">Good {new Date().getHours() < 12 ? 'morning' : 'afternoon'}, {user.fullName.split(' ')[0]}.</h1><p className="page-subtitle">{user.role === 'requester' ? 'Your support requests, with clear next steps.' : 'Here’s the work that needs a clear owner.'}</p></div><button className="btn btn-primary" onClick={() => setShowCreate(true)} data-testid="button-create-ticket"><FilePlus2 size={15} />New request</button></div>
    {summary.isLoading ? <div className="metric-grid">{[1, 2, 3, 4].map((x) => <div className="panel metric" key={x}><div className="skeleton" /><div className="skeleton" /></div>)}</div> : summary.isError ? <div className="panel" style={{ marginBottom: 18 }}><Problem retry={() => summary.refetch()} text="The service summary is temporarily unavailable." /></div> : <div className="metric-grid">{metricData.map(({ label, value, foot, icon: Icon }) => <div className="panel metric" key={label} data-testid={`metric-${label.toLowerCase().replaceAll(' ', '-')}`}><div style={{ display: 'flex', justifyContent: 'space-between' }}><div className="metric-label">{label}</div><Icon size={16} color="#148b73" /></div><div className="metric-value">{value}</div><div className="metric-foot">{foot}</div></div>)}</div>}
    <div className="dashboard-grid">
      <section className="panel"><div className="panel-head"><div><div className="panel-title">Recent work</div><div className="panel-kicker">Latest ticket activity across your queue</div></div><Link href="/tickets" className="btn btn-small" data-testid="link-view-all-tickets">All tickets <ArrowRight size={13} /></Link></div>
        {tickets.isLoading ? <LoadRows /> : tickets.isError ? <Problem retry={() => tickets.refetch()} /> : ordered.length ? <div className="ticket-list">{ordered.map((ticket) => <TicketItem key={ticket.id} ticket={ticket} />)}</div> : <Empty title="A clear queue." detail="There are no requests to show yet. New requests will appear here." action={<button className="btn btn-primary btn-small" onClick={() => setShowCreate(true)} data-testid="button-empty-create">Create a request</button>} />}
        {summary.data && <div className="workload"><span>Average resolution</span><strong>{summary.data.averageResolutionHours} hours</strong></div>}
      </section>
      <div style={{ display: 'grid', alignContent: 'start', gap: 16 }}>
        <section className="panel"><div className="panel-head"><div><div className="panel-title">Priority distribution</div><div className="panel-kicker">Open service workload</div></div><Filter size={15} color="#85929b" /></div>
          {summary.isLoading ? <LoadRows /> : summary.isError ? <Problem retry={() => summary.refetch()} /> : <div className="category-bars">{summary.data?.byPriority.map(({ priority, count }) => { const max = Math.max(1, ...summary.data!.byPriority.map((item) => item.count)); return <div className="category-row" key={priority}><span><PriorityBadge priority={priority} /></span><div className="bar-track"><div className="bar-fill" style={{ width: `${(count / max) * 100}%`, background: priority === 'P1' ? '#c94b42' : priority === 'P2' ? '#da9634' : priority === 'P3' ? '#2387a3' : '#15977e' }} /></div><strong>{count}</strong></div>; })}</div>}
        </section>
        <section className="panel"><div className="panel-head"><div><div className="panel-title">By category</div><div className="panel-kicker">Where requests are coming from</div></div></div>
          {summary.isLoading ? <LoadRows /> : summary.isError ? <Problem retry={() => summary.refetch()} /> : summary.data?.byCategory.length ? <div className="category-bars">{summary.data.byCategory.slice(0, 5).map(({ category, count }) => { const max = Math.max(1, ...summary.data!.byCategory.map((item) => item.count)); return <div className="category-row" key={category}><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{category}</span><div className="bar-track"><div className="bar-fill" style={{ width: `${count / max * 100}%` }} /></div><strong>{count}</strong></div>; })}</div> : <div style={{ padding: 18 }}><Empty title="No categories yet" detail="Category totals appear as requests arrive." /></div>}
        </section>
      </div>
    </div>
    {showCreate && <TicketCreate close={() => setShowCreate(false)} onCreated={(ticket) => { setShowCreate(false); navigate(`/tickets/${ticket.id}`); }} />}
  </div>;
}
