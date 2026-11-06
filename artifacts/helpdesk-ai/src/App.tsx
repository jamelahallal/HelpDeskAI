import { useEffect, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Link, Route, Switch, useLocation, useRoute } from 'wouter';
import {
  Activity, AlertCircle, ArrowLeft, ArrowRight, ArrowUpRight, CircleHelp, Clock3, Copy,
  FilePlus2, Filter, Headphones, LayoutDashboard, LogOut, MessageSquare, Search, Send,
  ShieldCheck, Sparkles, Ticket as TicketIcon, X,
} from 'lucide-react';
import {
  getGetCurrentUserQueryKey, getGetDashboardSummaryQueryKey, getGetTicketQueryKey,
  getListAgentsQueryKey, getListTicketsQueryKey, useCreateTicket, useCreateTicketComment,
  useGetCurrentUser, useGetDashboardSummary, useGetTicket, useListAgents, useListTickets,
  useLoginUser, useLogoutUser, useRegisterUser, useUpdateTicketAssignment,
  useUpdateTicketPriority, useUpdateTicketStatus,
} from '@workspace/api-client-react';
import type { Ticket, TicketDetail, TicketPriority, TicketStatus, User } from '@workspace/api-client-react';
import NotFound from '@/pages/not-found';
import AdminPage from '@/pages/admin';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } });
const statusText: Record<TicketStatus, string> = { new: 'New', assigned: 'Assigned', in_progress: 'In progress', resolved: 'Resolved', closed: 'Closed' };
const priorities: TicketPriority[] = ['P1', 'P2', 'P3', 'P4'];
const statuses: TicketStatus[] = ['new', 'assigned', 'in_progress', 'resolved', 'closed'];

function dateLabel(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date);
}
function ago(value: string) {
  const delta = Math.max(0, Date.now() - new Date(value).getTime());
  const mins = Math.floor(delta / 60000);
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return `${Math.floor(mins / 1440)}d ago`;
}
function titleCase(value: string) { return value.replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase()); }
function Avatar({ user }: { user: User }) { return <div className="avatar" data-testid={`avatar-user-${user.id}`}>{user.initials}</div>; }
function StatusBadge({ status }: { status: TicketStatus }) { return <span className={`badge status-${status}`} data-testid={`status-ticket-${status}`}>{statusText[status]}</span>; }
function PriorityBadge({ priority }: { priority: TicketPriority }) { return <span className={`badge priority-${priority}`} data-testid={`priority-ticket-${priority}`}>{priority}</span>; }
function LoadRows() { return <div style={{ padding: '10px 20px' }} aria-label="Loading tickets">{[1, 2, 3, 4].map((item) => <div className="skeleton" key={item} />)}</div>; }
function Problem({ retry, text = 'We couldn’t load this information.' }: { retry: () => void; text?: string }) {
  return <div className="error-state"><div className="empty-icon"><AlertCircle size={19} /></div><h3>Something needs a second try</h3><p>{text}</p><button className="btn btn-small" onClick={retry} data-testid="button-retry">Try again</button></div>;
}
function Empty({ title, detail, action }: { title: string; detail: string; action?: React.ReactNode }) {
  return <div className="empty-state"><div className="empty-icon"><CircleHelp size={20} /></div><h3>{title}</h3><p>{detail}</p>{action}</div>;
}

function AppFrame({ user, children }: { user: User; children: React.ReactNode }) {
  const [, navigate] = useLocation();
  const logout = useLogoutUser();
  const client = useQueryClient();
  const [error, setError] = useState('');
  const signOut = () => logout.mutate(undefined, { onSuccess: () => { client.clear(); navigate('/login'); }, onError: () => setError('Sign out did not complete. Please try again.') });
  const nav = [
    { href: '/', label: 'Overview', icon: LayoutDashboard },
    { href: '/tickets', label: 'Tickets', icon: TicketIcon },
    ...(user.role === 'admin' ? [{ href: '/admin', label: 'Admin', icon: ShieldCheck }] : []),
  ];
  return <div className="app-shell">
    <aside className="sidebar">
      <Link href="/" className="brand" data-testid="link-brand"><span className="brand-mark"><Headphones size={17} /></span><span>helpdesk<span style={{ color: '#54c9b0' }}>ai</span></span></Link>
      <div className="nav-wrap">
        <div className="nav-label">Workspace</div>
        <nav className="nav-list">{nav.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={`nav-item ${location.pathname === href || (href === '/tickets' && location.pathname.startsWith('/tickets/')) ? 'active' : ''}`} data-testid={`link-nav-${label.toLowerCase()}`}><Icon size={17} /><span>{label}</span></Link>)}</nav>
      </div>
      <div className="side-foot">
        <div className="user-mini"><Avatar user={user} /><div><div className="user-name" data-testid="text-current-user">{user.fullName}</div><div className="user-role">{user.role}</div></div></div>
        <button className="logout" onClick={signOut} disabled={logout.isPending} aria-label="Sign out" data-testid="button-logout"><LogOut size={14} /><span className="logout-text">{logout.isPending ? 'Signing out…' : 'Sign out'}</span></button>
      </div>
      {error && <span className="form-error">{error}</span>}
    </aside>
    <main className="main-area">
      <header className="topbar"><div className="crumb"><span>Support operations</span><ArrowRight size={13} /><span style={{ color: '#344454' }}>Service desk</span></div><div className="top-actions"><span className="live-label">Systems operational</span><Avatar user={user} /></div></header>
      {children}
    </main>
  </div>;
}

function Protected({ children }: { children: (user: User) => React.ReactNode }) {
  const [where, go] = useLocation();
  const current = useGetCurrentUser({ query: { queryKey: getGetCurrentUserQueryKey(), retry: false } });
  useEffect(() => { if (current.isError) go('/login'); }, [current.isError, go]);
  if (current.isLoading || (!current.data && !current.isError)) return <div className="auth-page"><div className="auth-art"><Brand /><div className="auth-copy"><h1>Every issue,<br />owned.</h1><p>Clear requests, visible service levels, and accountable resolution.</p></div><div className="auth-stat">SERVICE DESK / SECURE WORKSPACE</div></div><div className="auth-form-side"><div className="auth-card"><div className="skeleton" /><div className="skeleton" /><div className="skeleton" /></div></div></div>;
  if (current.isError) return <SignIn />;
  return <AppFrame user={current.data!}>{children(current.data!)}</AppFrame>;
}
function Brand() { return <div className="brand"><span className="brand-mark"><Headphones size={17} /></span><span>helpdesk<span style={{ color: '#54c9b0' }}>ai</span></span></div>; }

function SignIn({ register = false }: { register?: boolean }) {
  const [, navigate] = useLocation();
  const client = useQueryClient();
  const login = useLoginUser();
  const createAccount = useRegisterUser();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const pending = login.isPending || createAccount.isPending;
  const submit = (event: React.FormEvent) => {
    event.preventDefault(); setError('');
    if (register) {
      createAccount.mutate({ data: { fullName: fullName.trim(), email: email.trim(), password } }, {
        onSuccess: (session) => { client.setQueryData(getGetCurrentUserQueryKey(), session.user); navigate('/'); },
        onError: (err) => setError(err.message || 'We could not create your account. Check your details and try again.'),
      });
    } else {
      login.mutate({ data: { email: email.trim(), password } }, {
        onSuccess: (session) => { client.setQueryData(getGetCurrentUserQueryKey(), session.user); navigate('/'); },
        onError: (err) => setError(err.message || 'Email or password was not accepted. Please try again.'),
      });
    }
  };
  return <div className="auth-page">
    <section className="auth-art"><Brand /><div className="auth-copy"><div className="eyebrow" style={{ color: '#76cdbb' }}>IT SERVICE OPERATIONS / 01</div><h1>Support that<br />moves work forward.</h1><p>One clear path from request to resolution. Know who owns the next step, and when it’s due.</p><div className="auth-stat">ACCOUNTABLE SUPPORT · MEASURABLE SERVICE</div></div><div style={{ color: '#92a4ae', fontSize: 11 }}>HelpDeskAI · Service desk workspace</div></section>
    <section className="auth-form-side"><div className="auth-card fade-in">
      <div className="eyebrow">{register ? 'REQUESTER ACCESS' : 'WELCOME BACK'}</div>
      <h2>{register ? 'Create your account' : 'Sign in to HelpDeskAI'}</h2>
      <p>{register ? 'Set up a requester account to log and track support.' : 'Use your work account to continue to the service desk.'}</p>
      {error && <div role="alert" className="form-error" data-testid="text-auth-error">{error}</div>}
      <form onSubmit={submit}>
        {register && <div className="form-group"><label className="form-label" htmlFor="fullName">Full name</label><input className="field" id="fullName" autoComplete="name" minLength={2} maxLength={100} required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" data-testid="input-full-name" /></div>}
        <div className="form-group"><label className="form-label" htmlFor="email">Work email</label><input className="field" id="email" type="email" autoComplete="email" maxLength={254} required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" data-testid="input-email" /></div>
        <div className="form-group"><label className="form-label" htmlFor="password">Password</label><input className="field" id="password" type="password" autoComplete={register ? 'new-password' : 'current-password'} minLength={register ? 10 : 1} maxLength={128} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder={register ? 'At least 10 characters' : 'Enter your password'} data-testid="input-password" /></div>
        <button className="btn btn-primary" type="submit" disabled={pending} data-testid="button-auth-submit">{pending ? 'Working…' : register ? 'Create requester account' : 'Sign in'}{!pending && <ArrowRight size={15} />}</button>
      </form>
      {((register && createAccount.isSuccess) || (!register && login.isSuccess)) && <div className="success-note" data-testid="text-auth-success">Account verified. Opening your workspace…</div>}
      <div className="auth-switch">{register ? <>Already have access? <Link href="/login" data-testid="link-login">Sign in</Link></> : <>New to the service desk? <Link href="/register" data-testid="link-register">Create requester account</Link></>}</div>
      <div style={{ textAlign: 'center', marginTop: 32, color: '#9aa5ac', fontSize: 10 }}><ShieldCheck size={13} style={{ verticalAlign: 'middle', marginRight: 5 }} />Protected service desk access</div>
    </div></section>
  </div>;
}

function TicketCreate({ close, onCreated }: { close: () => void; onCreated: (ticket: Ticket) => void }) {
  const client = useQueryClient();
  const create = useCreateTicket();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState<TicketPriority>('P3');
  const [error, setError] = useState('');
  const submit = (event: React.FormEvent) => {
    event.preventDefault(); setError('');
    create.mutate({ data: { title: title.trim(), description: description.trim(), category: category.trim(), priority } }, {
      onSuccess: (ticket) => { client.invalidateQueries({ queryKey: getListTicketsQueryKey() }); client.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() }); onCreated(ticket); },
      onError: (e) => setError(e.message || 'The request could not be submitted. Try again.'),
    });
  };
  return <div role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }} style={{ position: 'fixed', inset: 0, background: '#17283880', zIndex: 8, display: 'grid', placeItems: 'center', padding: 16 }}>
    <div role="dialog" aria-modal="true" aria-labelledby="create-title" className="panel fade-in" style={{ width: 'min(100%, 540px)', padding: 25 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}><div><div className="eyebrow">NEW SUPPORT REQUEST</div><h2 id="create-title" className="display" style={{ margin: 0, fontSize: 24 }}>What needs attention?</h2><p className="page-subtitle">Add enough detail for the right person to pick this up.</p></div><button className="btn btn-small" onClick={close} aria-label="Close form" data-testid="button-close-create"><X size={16} /></button></div>
      {error && <div className="form-error" style={{ marginTop: 16 }} data-testid="text-create-error">{error}</div>}
      <form onSubmit={submit} style={{ marginTop: 22 }}>
        <div className="form-group"><label className="form-label" htmlFor="ticket-title">Request title</label><input id="ticket-title" className="field" required minLength={5} maxLength={160} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="A short summary of the issue" data-testid="input-ticket-title" /></div>
        <div className="form-group"><label className="form-label" htmlFor="ticket-description">What’s happening?</label><textarea id="ticket-description" className="textarea" required minLength={10} maxLength={10000} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Include what you were trying to do and any relevant details." data-testid="input-ticket-description" /></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group"><label className="form-label" htmlFor="ticket-category">Category</label><input id="ticket-category" className="field" required minLength={2} maxLength={80} value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Access, Hardware" data-testid="input-ticket-category" /></div>
          <div className="form-group"><label className="form-label" htmlFor="ticket-priority">Priority</label><select id="ticket-priority" className="select" style={{ width: '100%' }} value={priority} onChange={(e) => setPriority(e.target.value as TicketPriority)} data-testid="select-ticket-priority">{priorities.map((p) => <option key={p} value={p}>{p} · {p === 'P1' ? 'Critical' : p === 'P2' ? 'High' : p === 'P3' ? 'Normal' : 'Low'}</option>)}</select></div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 9, marginTop: 6 }}><button type="button" className="btn" onClick={close} data-testid="button-cancel-create">Cancel</button><button type="submit" className="btn btn-primary" disabled={create.isPending} data-testid="button-submit-ticket">{create.isPending ? 'Submitting…' : 'Submit request'}<ArrowRight size={14} /></button></div>
      </form>
    </div>
  </div>;
}

function TicketItem({ ticket }: { ticket: Ticket }) {
  return <Link href={`/tickets/${ticket.id}`} className="ticket-row" data-testid={`link-ticket-${ticket.id}`}>
    <div style={{ minWidth: 0 }}><div className="ticket-id">HD-{ticket.id}</div><div className="ticket-link-title">{ticket.title}</div><div className="ticket-meta">{ticket.requester.fullName} · {ticket.category}</div></div>
    <div><PriorityBadge priority={ticket.priority} /><div style={{ marginTop: 7 }}><StatusBadge status={ticket.status} /></div></div>
    <div className="sla-cell"><div style={{ fontSize: 10, color: '#72818d' }}>SLA {ticket.slaPercent}%</div><div className="sla-track"><div className={`sla-fill ${ticket.slaState}`} style={{ width: `${Math.min(100, Math.max(0, ticket.slaPercent))}%` }} /></div><div className="sla-text">{ticket.slaState === 'breached' ? 'Breached' : ticket.slaState === 'warning' ? 'At risk' : ticket.slaState === 'resolved' ? 'Resolved' : 'On track'}</div></div>
  </Link>;
}

function Dashboard({ user }: { user: User }) {
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

function TicketsPage() {
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

type AiAnalysis = {
  category: string;
  priority: TicketPriority;
  urgency: string;
  summary: string;
  suggestedTeam: string;
  suggestedReply: string;
  provider: string;
  model: string;
  createdAt: string;
  suggestedArticles?: { id: string; title: string }[];
};

function AiAnalysisCard({ ai, currentPriority, currentCategory, onUseReply, onApplyPriority, applying }: {
  ai: AiAnalysis;
  currentPriority: TicketPriority;
  currentCategory: string;
  onUseReply: (text: string) => void;
  onApplyPriority: (priority: TicketPriority) => void;
  applying: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(ai.suggestedReply); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard unavailable */ }
  };
  const priorityDiffers = ai.priority !== currentPriority;
  return <section className="panel" style={{ marginTop: 16 }} data-testid="panel-ai-analysis">
    <div className="panel-head">
      <div><div className="panel-title"><Sparkles size={14} style={{ verticalAlign: 'middle', marginRight: 6, color: '#148b73' }} />AI analysis</div><div className="panel-kicker">Suggestions for the service desk. Only agents and admins see this.</div></div>
      <span className="badge" style={{ background: '#f0f3f4', color: '#687985' }}>{ai.urgency}</span>
    </div>
    <div style={{ padding: '0 21px 20px' }}>
      <p className="detail-description" style={{ marginTop: 0 }} data-testid="text-ai-summary">{ai.summary}</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 14 }}>
        <span style={{ fontSize: 11, color: '#778691' }}>Suggested priority</span><PriorityBadge priority={ai.priority} />
        <span style={{ fontSize: 11, color: '#778691', marginLeft: 8 }}>Team</span><strong style={{ fontSize: 12 }}>{ai.suggestedTeam}</strong>
        <span style={{ fontSize: 11, color: '#778691', marginLeft: 8 }}>Category</span>
        <strong style={{ fontSize: 12 }}>{ai.category}</strong>
        {ai.category.toLowerCase() !== currentCategory.toLowerCase() && <span style={{ fontSize: 10, color: '#a96b21' }}>(ticket says {currentCategory})</span>}
      </div>
      {priorityDiffers && <button className="btn btn-small" style={{ marginBottom: 14 }} onClick={() => onApplyPriority(ai.priority)} disabled={applying} data-testid="button-apply-ai-priority">Set priority to {ai.priority}</button>}
       <div className="property-label" style={{ marginBottom: 6 }}>Knowledge base articles used</div>
      <div style={{ fontSize: 12, marginBottom: 14 }} data-testid="text-ai-articles">
        {ai.suggestedArticles?.length
          ? ai.suggestedArticles.map((a) => <div key={a.id}>{a.title}</div>)
          : <span style={{ color: '#98a2a9' }}>None matched</span>}
      </div>

      <div className="property-label" style={{ marginBottom: 6 }}>Draft reply</div>
      <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 12.5, lineHeight: 1.55, background: '#f8fafb', border: '1px solid #edf0f2', borderRadius: 8, padding: 14, margin: 0 }} data-testid="text-ai-reply">{ai.suggestedReply}</pre>
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button className="btn btn-small" onClick={copy} data-testid="button-copy-ai-reply"><Copy size={13} />{copied ? 'Copied' : 'Copy'}</button>
        <button className="btn btn-small btn-primary" onClick={() => onUseReply(ai.suggestedReply)} data-testid="button-use-ai-reply">Use as update</button>
      </div>
      <div style={{ marginTop: 12, fontSize: 10, color: '#98a2a9' }}>{ai.provider} · {ai.model} · {dateLabel(ai.createdAt)}</div>
    </div>
  </section>;
}

function TicketDetailPage({ user }: { user: User }) {
  const [, params] = useRoute('/tickets/:ticketId');
  const ticketId = params?.ticketId ?? '';
  const client = useQueryClient();
  const [, navigate] = useLocation();
  const ticketQuery = useGetTicket(ticketId);
  const agents = useListAgents({ query: { enabled: user.role === 'admin', queryKey: getListAgentsQueryKey() } });
  const addComment = useCreateTicketComment();
  const updateStatus = useUpdateTicketStatus();
  const updatePriority = useUpdateTicketPriority();
  const updateAssignment = useUpdateTicketAssignment();
  const ticket = ticketQuery.data as TicketDetail | undefined;
  const [body, setBody] = useState('');
  const [internal, setInternal] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [commentError, setCommentError] = useState('');
  const canManage = user.role === 'agent' || user.role === 'admin';
  const canClose = user.role === 'requester' && ticket?.status === 'resolved';
  const nextStatuses: Record<TicketStatus, TicketStatus[]> = {
    new: ['assigned'],
    assigned: ['in_progress'],
    in_progress: ['resolved'],
    resolved: ['closed'],
    closed: [],
  };
  const refresh = () => { client.invalidateQueries({ queryKey: getGetTicketQueryKey(ticketId) }); client.invalidateQueries({ queryKey: getListTicketsQueryKey() }); client.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() }); };
  const runAction = (action: () => void) => { setActionError(''); setActionSuccess(''); action(); };
  const mutateStatus = (value: TicketStatus) => runAction(() => updateStatus.mutate({ ticketId, data: { status: value } }, { onSuccess: () => { refresh(); setActionSuccess('Status updated.'); }, onError: (e) => setActionError(e.message || 'Status update failed.') }));
  const mutatePriority = (value: TicketPriority) => runAction(() => updatePriority.mutate({ ticketId, data: { priority: value } }, { onSuccess: () => { refresh(); setActionSuccess('Priority updated.'); }, onError: (e) => setActionError(e.message || 'Priority update failed.') }));
  const mutateAssignment = (value: string) => runAction(() => updateAssignment.mutate({ ticketId, data: { agentId: value || null } }, { onSuccess: () => {
    // An agent can only open tickets that are unassigned or assigned to them, so handing a ticket to someone else takes it out of their view.
    if (user.role === 'agent' && value && value !== user.id) {
      client.removeQueries({ queryKey: getGetTicketQueryKey(ticketId) });
      client.invalidateQueries({ queryKey: getListTicketsQueryKey() });
      client.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      navigate('/tickets');
      return;
    }
    refresh(); setActionSuccess('Assignment updated.');
  }, onError: (e) => setActionError(e.message || 'Assignment update failed.') }));
  const submitComment = (event: React.FormEvent) => {
    event.preventDefault(); setCommentError('');
    addComment.mutate({ ticketId, data: { body: body.trim(), isInternal: canManage && internal } }, { onSuccess: () => { setBody(''); refresh(); }, onError: (e) => setCommentError(e.message || 'Comment could not be posted.') });
  };
  if (ticketQuery.isLoading) return <div className="content"><div className="skeleton" style={{ height: 28, width: 230 }} /><div className="panel" style={{ marginTop: 22, padding: 22 }}>{[1, 2, 3, 4].map((x) => <div className="skeleton" key={x} />)}</div></div>;
  if (ticketQuery.isError || !ticket) return <div className="content"><Link href="/tickets" className="bread-link" data-testid="link-back-tickets"><ArrowLeft size={14} />Back to tickets</Link><div className="panel"><Problem retry={() => ticketQuery.refetch()} text="This ticket could not be loaded. It may no longer be available to your account." /></div></div>;
        const aiAnalysis = canManage ? ((ticket as TicketDetail & { aiAnalysis?: AiAnalysis | null }).aiAnalysis ?? null) : null;
  return <div className="content fade-in">
    <Link href="/tickets" className="bread-link" data-testid="link-back-tickets"><ArrowLeft size={14} />Back to tickets</Link>
    <div className="page-heading"><div><div className="eyebrow">TICKET / HD-{ticket.id} / {titleCase(ticket.category)}</div><h1 className="page-title" data-testid="text-ticket-title">{ticket.title}</h1><p className="page-subtitle">Opened by {ticket.requester.fullName} · {dateLabel(ticket.createdAt)}</p></div>{canManage && <div style={{ display: 'flex', gap: 8 }}><select className="select" aria-label="Update status" value={ticket.status} onChange={(e) => mutateStatus(e.target.value as TicketStatus)} disabled={updateStatus.isPending} data-testid="select-update-status"><option value={ticket.status}>{statusText[ticket.status]}</option>{nextStatuses[ticket.status].map((status) => <option key={status} value={status}>{statusText[status]}</option>)}</select></div>}{canClose && <button className="btn btn-primary" onClick={() => mutateStatus('closed')} disabled={updateStatus.isPending} data-testid="button-close-ticket">{updateStatus.isPending ? 'Closing…' : 'Close request'}</button>}</div>
    {(actionError || actionSuccess) && <div className={actionError ? 'form-error' : 'success-note'} role="status" style={{ margin: '0 0 14px' }} data-testid={actionError ? 'text-ticket-action-error' : 'text-ticket-action-success'}>{actionError || actionSuccess}</div>}
    <div className="detail-layout">
      <div>
        <section className="panel detail-main"><div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}><div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><StatusBadge status={ticket.status} /><PriorityBadge priority={ticket.priority} /></div><span className="mono" style={{ color: '#8b98a1', fontSize: 10 }}>UPDATED {dateLabel(ticket.updatedAt).toUpperCase()}</span></div>
          <p className="detail-description" data-testid="text-ticket-description">{ticket.description}</p>
          <div style={{ borderTop: '1px solid #edf0f2', paddingTop: 17, display: 'flex', justifyContent: 'space-between', color: '#86939c', fontSize: 11 }}><span><MessageSquare size={13} style={{ verticalAlign: 'middle', marginRight: 6 }} />{ticket.comments.length} updates</span><span>SLA due {dateLabel(ticket.slaDeadline)}</span></div>
        </section>
        {aiAnalysis && <AiAnalysisCard
          ai={aiAnalysis}
          currentPriority={ticket.priority}
          currentCategory={ticket.category}
          onUseReply={(text) => { setInternal(false); setBody(text); document.getElementById('comment-body')?.focus(); }}
          onApplyPriority={mutatePriority}
          applying={updatePriority.isPending}
        />}
        <section className="panel comments"><div className="panel-head"><div><div className="panel-title">Updates & notes</div><div className="panel-kicker">A shared record of what’s happening</div></div><span className="badge" style={{ background: '#f0f3f4', color: '#687985' }}>{ticket.comments.length}</span></div>
          <div style={{ padding: '0 21px' }}>
            {!ticket.comments.length ? <Empty title="First update starts here" detail="Add context or a progress note to keep everyone aligned." /> : [...ticket.comments].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()).map((comment) => <article className="comment" key={comment.id} data-testid={`comment-${comment.id}`}><div className="comment-head"><Avatar user={comment.author} /><span className="comment-name">{comment.author.fullName}</span>{comment.isInternal && <span className="internal-label">Internal note</span>}<span className="comment-time">{ago(comment.createdAt)}</span></div><p className="comment-body">{comment.body}</p></article>)}
            <form className="comment-form" onSubmit={submitComment}>
              <label className="form-label" htmlFor="comment-body">{canManage && internal ? 'Internal note' : 'Add an update'}</label>
              <textarea className="textarea" id="comment-body" required maxLength={5000} value={body} onChange={(e) => setBody(e.target.value)} placeholder={canManage && internal ? 'Only service desk agents can see this note.' : 'Share an update or ask a follow-up…'} data-testid="input-comment-body" />
              {commentError && <div className="form-error" style={{ marginTop: 10 }} data-testid="text-comment-error">{commentError}</div>}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                {canManage ? <label style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#778691', fontSize: 11 }}><input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} data-testid="checkbox-internal-note" />Internal note</label> : <span style={{ fontSize: 10, color: '#98a2a9' }}>Visible to requester and service desk</span>}
                <button type="submit" className="btn btn-primary btn-small" disabled={addComment.isPending || !body.trim()} data-testid="button-submit-comment">{addComment.isPending ? 'Posting…' : 'Post update'}<Send size={13} /></button>
              </div>
            </form>
          </div>
        </section>
      </div>
      <aside className="panel detail-aside"><h3>Service context</h3>
        <div className="property"><div className="property-label">SLA health</div><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span className="property-value">{titleCase(ticket.slaState)}</span><strong className="mono" style={{ color: ticket.slaState === 'breached' ? '#b64036' : ticket.slaState === 'warning' ? '#a96b21' : '#16826c', fontSize: 11 }}>{ticket.slaPercent}%</strong></div><div className="sla-track" style={{ width: '100%', marginTop: 10, height: 6 }}><div className={`sla-fill ${ticket.slaState}`} style={{ width: `${Math.max(0, Math.min(100, ticket.slaPercent))}%` }} /></div><div className="sla-text">Deadline {dateLabel(ticket.slaDeadline)}</div></div>
        <div className="property"><div className="property-label">Requester</div><div className="user-mini"><Avatar user={ticket.requester} /><div><div className="property-value">{ticket.requester.fullName}</div><div style={{ color: '#87949d', fontSize: 10, marginTop: 3 }}>{ticket.requester.email}</div></div></div></div>
        <div className="property"><div className="property-label">Assigned agent</div>{user.role === 'agent' ? <div>
          <div className="property-value" data-testid="text-assigned-agent">{ticket.assignedAgent ? (ticket.assignedAgent.id === user.id ? 'You' : ticket.assignedAgent.fullName) : 'Unassigned'}</div>
          {!ticket.assignedAgent && <button className="btn btn-small btn-primary" style={{ marginTop: 10, width: '100%', justifyContent: 'center' }} onClick={() => mutateAssignment(user.id)} disabled={updateAssignment.isPending} data-testid="button-assign-to-me">Assign to me</button>}
          {ticket.assignedAgent?.id === user.id && <button className="btn btn-small" style={{ marginTop: 10, width: '100%', justifyContent: 'center' }} onClick={() => mutateAssignment('')} disabled={updateAssignment.isPending} data-testid="button-release-ticket">Release ticket</button>}
        </div> : canManage ? <select className="select" style={{ width: '100%' }} value={ticket.assignedAgent?.id ?? ''} onChange={(e) => mutateAssignment(e.target.value)} disabled={updateAssignment.isPending || agents.isLoading} data-testid="select-assigned-agent"><option value="">Unassigned</option>{agents.data?.map((agent) => <option key={agent.id} value={agent.id}>{agent.fullName}</option>)}</select> : <div className="property-value">{ticket.assignedAgent?.fullName || 'Awaiting assignment'}</div>}{agents.isError && user.role === 'admin' && <div style={{ fontSize: 10, color: '#b64036', marginTop: 6 }}>Agent list unavailable. Try refreshing.</div>}</div>
        {canManage && <div className="property"><div className="property-label">Priority</div><select className="select" style={{ width: '100%' }} value={ticket.priority} onChange={(e) => mutatePriority(e.target.value as TicketPriority)} disabled={updatePriority.isPending} data-testid="select-update-priority">{priorities.map((p) => <option key={p} value={p}>{p} · {p === 'P1' ? 'Critical' : p === 'P2' ? 'High' : p === 'P3' ? 'Normal' : 'Low'}</option>)}</select></div>}
        <div className="property"><div className="property-label">Category</div><div className="property-value">{ticket.category}</div></div>
        <div className="property"><div className="property-label">Opened</div><div className="property-value">{dateLabel(ticket.createdAt)}</div></div>
        {ticket.resolvedAt && <div className="property"><div className="property-label">Resolved</div><div className="property-value">{dateLabel(ticket.resolvedAt)}</div></div>}
        {(updateStatus.isPending || updateAssignment.isPending || updatePriority.isPending) && <div className="success-note" data-testid="text-ticket-saving">Saving service update…</div>}
      </aside>
    </div>
  </div>;
}

function Router() {
  const [location] = useLocation();
  if (location === '/login') return <SignIn />;
  if (location === '/register') return <SignIn register />;
  return <Protected>{(user) => <Switch>
    <Route path="/" component={() => <Dashboard user={user} />} />
    <Route path="/tickets" component={TicketsPage} />
    <Route path="/tickets/:ticketId" component={() => <TicketDetailPage user={user} />} />
    <Route path="/admin" component={() => <AdminPage user={user} />} />
    <Route component={NotFound} />
  </Switch>}</Protected>;
}
function App() {
  return <QueryClientProvider client={queryClient}><Router /></QueryClientProvider>;
}

export default App;
