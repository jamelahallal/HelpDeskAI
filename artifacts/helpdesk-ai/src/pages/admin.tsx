import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { KeyRound, Plus, Search, UserCheck, UserX, X } from 'lucide-react';
import { KnowledgeBasePage } from '@/pages/knowledge-base';
import {
  getAdminListAutomationLogsQueryKey,
  useAdminListAutomationLogs,
  useAdminListSlaRules,
  getAdminListSlaRulesQueryKey,
  getAdminListUsersQueryKey,
  useAdminCreateUser,
  useAdminListUsers,
  useAdminUpdateSlaRule,
  useAdminUpdateUser,
} from '@workspace/api-client-react';
import type { AutomationLogStatus } from '@workspace/api-client-react';
import type { ManagedUser, SlaRule, TicketPriority, User, UserRole } from '@workspace/api-client-react';

const roles: UserRole[] = ['requester', 'agent', 'admin'];
const roleClass: Record<UserRole, string> = { requester: 'status-new', agent: 'status-assigned', admin: 'status-in_progress' };
const MIN_PASSWORD = 10;

/** Show the server's plain message when it sent one; fall back to friendly text otherwise. */
function apiMessage(error: unknown, fallback: string): string {
  const data = (error as { data?: { error?: unknown } } | null)?.data;
  const text = typeof data?.error === 'string' ? data.error : '';
  return text && !text.startsWith('[') ? text : fallback;
}

function shortDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en', { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
}

function Notice({ error, success }: { error: string; success: string }) {
  return <>
    {error && <div role="alert" className="form-error" data-testid="text-admin-error">{error}</div>}
    {success && <div role="status" className="success-note" style={{ margin: '0 0 15px' }} data-testid="text-admin-success">{success}</div>}
  </>;
}

function CreateUserForm({ onDone, onCreated, onError }: { onDone: () => void; onCreated: (name: string) => void; onError: (message: string) => void }) {
  const client = useQueryClient();
  const create = useAdminCreateUser();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('agent');

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    onError('');
    create.mutate({ data: { fullName: fullName.trim(), email: email.trim(), password, role } }, {
      onSuccess: (user) => {
        client.invalidateQueries({ queryKey: getAdminListUsersQueryKey() });
        onCreated(user.fullName);
        onDone();
      },
      onError: (err) => onError(apiMessage(err, 'We could not create that account. Check the details and try again.')),
    });
  };

  return <form onSubmit={submit} className="panel fade-in" style={{ padding: 20, marginBottom: 16 }} aria-label="Create user">
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14 }}>
      <div className="form-group"><label className="form-label" htmlFor="new-user-name">Full name</label><input id="new-user-name" className="field" required minLength={2} maxLength={100} value={fullName} onChange={(e) => setFullName(e.target.value)} data-testid="input-new-user-name" /></div>
      <div className="form-group"><label className="form-label" htmlFor="new-user-email">Work email</label><input id="new-user-email" className="field" type="email" required maxLength={254} autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} data-testid="input-new-user-email" /></div>
      <div className="form-group"><label className="form-label" htmlFor="new-user-password">Temporary password</label><input id="new-user-password" className="field" type="password" required minLength={MIN_PASSWORD} maxLength={128} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={`At least ${MIN_PASSWORD} characters`} data-testid="input-new-user-password" /></div>
      <div className="form-group"><label className="form-label" htmlFor="new-user-role">Role</label><select id="new-user-role" className="select" style={{ width: '100%' }} value={role} onChange={(e) => setRole(e.target.value as UserRole)} data-testid="select-new-user-role">{roles.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
    </div>
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 9 }}>
      <button type="button" className="btn" onClick={onDone} data-testid="button-cancel-new-user">Cancel</button>
      <button type="submit" className="btn btn-primary" disabled={create.isPending} data-testid="button-save-new-user">{create.isPending ? 'Creating…' : 'Create account'}</button>
    </div>
  </form>;
}

function UserRow({ managed, isSelf, onError, onSuccess }: { managed: ManagedUser; isSelf: boolean; onError: (message: string) => void; onSuccess: (message: string) => void }) {
  const client = useQueryClient();
  const update = useAdminUpdateUser();
  const [resetting, setResetting] = useState(false);
  const [password, setPassword] = useState('');
  const selfHint = "You can't change your own role or status.";

  const save = (data: { role?: UserRole; isActive?: boolean; password?: string }, done: string, after?: () => void) => {
    onError('');
    update.mutate({ userId: managed.id, data }, {
      onSuccess: () => {
        client.invalidateQueries({ queryKey: getAdminListUsersQueryKey() });
        onSuccess(done);
        after?.();
      },
      onError: (err) => onError(apiMessage(err, 'That change could not be saved. Please try again.')),
    });
  };

  return <>
    <tr data-testid={`row-user-${managed.id}`} style={managed.isActive ? undefined : { opacity: 0.6 }}>
      <td><div className="user-mini"><div className="avatar">{managed.initials}</div><div><div className="ticket-name" style={{ maxWidth: 240 }}>{managed.fullName}{isSelf && <span className="ticket-sub" style={{ display: 'inline', marginLeft: 8 }}>you</span>}</div><div className="ticket-sub">{managed.email}</div></div></div></td>
      <td>
        <select className="select" style={{ minWidth: 118 }} aria-label={`Role for ${managed.fullName}`} value={managed.role} disabled={isSelf || update.isPending} title={isSelf ? selfHint : undefined} onChange={(e) => save({ role: e.target.value as UserRole }, `${managed.fullName} is now ${e.target.value}.`)} data-testid={`select-role-${managed.id}`}>
          {roles.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </td>
      <td><span className={`badge ${managed.isActive ? roleClass.agent : 'status-closed'}`} data-testid={`status-user-${managed.id}`}>{managed.isActive ? 'Active' : 'Inactive'}</span></td>
      <td className="mono" style={{ color: '#7d8b95' }}>{shortDate(managed.createdAt)}</td>
      <td>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-small" onClick={() => { setResetting((open) => !open); setPassword(''); }} disabled={update.isPending} data-testid={`button-reset-${managed.id}`}><KeyRound size={13} />Reset password</button>
          <button className="btn btn-small" disabled={isSelf || update.isPending} title={isSelf ? selfHint : undefined} onClick={() => save({ isActive: !managed.isActive }, managed.isActive ? `${managed.fullName} was deactivated.` : `${managed.fullName} was reactivated.`)} data-testid={`button-toggle-${managed.id}`}>
            {managed.isActive ? <><UserX size={13} />Deactivate</> : <><UserCheck size={13} />Reactivate</>}
          </button>
        </div>
      </td>
    </tr>
    {resetting && <tr><td colSpan={5} style={{ background: '#f8fafb' }}>
      <form style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }} onSubmit={(e) => { e.preventDefault(); save({ password }, `Password reset for ${managed.fullName}.`, () => { setResetting(false); setPassword(''); }); }}>
        <label className="form-label" htmlFor={`reset-${managed.id}`} style={{ margin: 0 }}>New password for {managed.fullName}</label>
        <input id={`reset-${managed.id}`} className="field" style={{ width: 240 }} type="password" required minLength={MIN_PASSWORD} maxLength={128} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={`At least ${MIN_PASSWORD} characters`} data-testid={`input-reset-${managed.id}`} />
        <button type="submit" className="btn btn-small btn-primary" disabled={update.isPending} data-testid={`button-save-reset-${managed.id}`}>Save password</button>
        <button type="button" className="btn btn-small" onClick={() => setResetting(false)}><X size={13} />Cancel</button>
      </form>
    </td></tr>}
  </>;
}

function UsersPanel({ currentUserId }: { currentUserId: string }) {
  const users = useAdminListUsers();
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (users.data ?? []).filter((item) =>
      (!role || item.role === role) &&
      (!needle || item.fullName.toLowerCase().includes(needle) || item.email.toLowerCase().includes(needle)));
  }, [users.data, search, role]);

  const report = (message: string) => { setError(''); setSuccess(message); };
  const fail = (message: string) => { setSuccess(''); setError(message); };

  return <>
    <div className="toolbar">
      <div className="search-wrap"><Search size={15} /><input className="field" type="search" placeholder="Search name or email…" aria-label="Search users" value={search} onChange={(e) => setSearch(e.target.value)} data-testid="input-search-users" /></div>
      <select className="select" aria-label="Filter by role" value={role} onChange={(e) => setRole(e.target.value)} data-testid="select-filter-role"><option value="">All roles</option>{roles.map((item) => <option key={item} value={item}>{item}</option>)}</select>
      <button className="btn btn-primary" onClick={() => { setAdding((open) => !open); setError(''); setSuccess(''); }} data-testid="button-add-user"><Plus size={14} />Add user</button>
    </div>
    <Notice error={error} success={success} />
    {adding && <CreateUserForm onDone={() => setAdding(false)} onCreated={(name) => report(`${name}'s account was created.`)} onError={fail} />}
    <section className="panel">
      <div className="panel-head"><div><div className="panel-title">Accounts</div><div className="panel-kicker">{users.data ? `${visible.length} of ${users.data.length} accounts` : 'Loading accounts…'}</div></div></div>
      {users.isLoading ? <div style={{ padding: '10px 20px' }}>{[1, 2, 3].map((item) => <div className="skeleton" key={item} />)}</div>
        : users.isError ? <div className="error-state"><h3>Accounts could not be loaded</h3><p>Check your connection, then try again.</p><button className="btn btn-small" onClick={() => users.refetch()}>Retry</button></div>
        : !visible.length ? <div className="empty-state"><h3>No matching accounts</h3><p>Try a different search or role filter.</p></div>
        : <div className="table-wrap"><table className="ticket-table"><thead><tr><th>User</th><th>Role</th><th>Status</th><th>Created</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
          <tbody>{visible.map((item) => <UserRow key={item.id} managed={item} isSelf={item.id === currentUserId} onError={fail} onSuccess={report} />)}</tbody></table></div>}
    </section>
  </>;
}

function SlaRow({ rule, onError, onSuccess }: { rule: SlaRule; onError: (message: string) => void; onSuccess: (message: string) => void }) {
  const client = useQueryClient();
  const update = useAdminUpdateSlaRule();
  const [draft, setDraft] = useState(String(rule.responseHours));
  const hours = Number(draft);
  const valid = draft.trim() !== '' && Number.isInteger(hours) && hours >= 1 && hours <= 720;
  const changed = valid && hours !== rule.responseHours;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    onError('');
    update.mutate({ priority: rule.priority, data: { responseHours: hours } }, {
      onSuccess: () => { client.invalidateQueries({ queryKey: getAdminListSlaRulesQueryKey() }); onSuccess(`${rule.priority} now allows ${hours} ${hours === 1 ? 'hour' : 'hours'}. It applies to new tickets.`); },
      onError: (err) => { setDraft(String(rule.responseHours)); onError(apiMessage(err, 'That rule could not be saved. Please try again.')); },
    });
  };

  return <tr data-testid={`row-sla-${rule.priority}`}>
    <td><span className={`badge priority-${rule.priority}`}>{rule.priority}</span></td>
    <td>
      <form onSubmit={submit} style={{ display: 'flex', gap: 9, alignItems: 'center' }}>
        <input className="field" style={{ width: 90 }} type="number" inputMode="numeric" min={1} max={720} step={1} aria-label={`Response hours for ${rule.priority}`} value={draft} onChange={(e) => setDraft(e.target.value)} data-testid={`input-sla-${rule.priority}`} />
        <span style={{ color: '#7d8b95', fontSize: 12 }}>hours</span>
        <button type="submit" className="btn btn-small btn-primary" disabled={!changed || update.isPending} data-testid={`button-save-sla-${rule.priority}`}>{update.isPending ? 'Saving…' : 'Save'}</button>
      </form>
    </td>
    <td className="mono" style={{ color: '#7d8b95' }}>{rule.updatedAt ? shortDate(rule.updatedAt) : 'Default'}</td>
  </tr>;
}

function SlaPanel() {
  const rules = useAdminListSlaRules();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  return <>
    <Notice error={error} success={success} />
    <section className="panel">
      <div className="panel-head"><div><div className="panel-title">Response-time targets</div><div className="panel-kicker">Changes apply to tickets created from now on. Existing tickets keep their deadlines.</div></div></div>
      {rules.isLoading ? <div style={{ padding: '10px 20px' }}>{[1, 2, 3, 4].map((item) => <div className="skeleton" key={item} />)}</div>
        : rules.isError ? <div className="error-state"><h3>SLA rules could not be loaded</h3><p>Check your connection, then try again.</p><button className="btn btn-small" onClick={() => rules.refetch()}>Retry</button></div>
        : <div className="table-wrap"><table className="ticket-table" style={{ minWidth: 480 }}><thead><tr><th>Priority</th><th>Respond within</th><th>Last changed</th></tr></thead>
          <tbody>{rules.data?.map((rule) => <SlaRow key={`${rule.priority}-${rule.responseHours}`} rule={rule} onError={(m) => { setSuccess(''); setError(m); }} onSuccess={(m) => { setError(''); setSuccess(m); }} />)}</tbody></table></div>}
    </section>
    <p style={{ color: '#7d8b95', fontSize: 12, marginTop: 14 }}>An urgent priority can never allow more time than a less urgent one (P1 ≤ P2 ≤ P3 ≤ P4).</p>
  </>;
}

const workflowLabel: Record<string, string> = {
  'new-ticket': 'New ticket',
  'sla-warning': 'SLA warning',
  'resolution-followup': 'Resolution follow-up',
  'p1-escalation': 'P1 escalation',
};

function dateTime(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit' }).format(date);
}

function AutomationPanel() {
  const [status, setStatus] = useState<'' | AutomationLogStatus>('');
  const [workflow, setWorkflow] = useState('');
  const params = useMemo(() => ({ limit: 100, ...(status ? { status } : {}), ...(workflow ? { workflow } : {}) }), [status, workflow]);
  const logs = useAdminListAutomationLogs(params, { query: { queryKey: getAdminListAutomationLogsQueryKey(params), refetchInterval: 15000 } });
  const summary = logs.data?.summary ?? [];

  return <>
    <div className="metric-grid" style={{ marginBottom: 16 }}>
  {summary.map((item) => {
    const total = item.success + item.failure;
    const okPercent = total ? (item.success / total) * 100 : 0;
    return <div className="panel metric" key={item.workflow} data-testid={`metric-workflow-${item.workflow}`}>
      <div className="metric-label">{workflowLabel[item.workflow] ?? item.workflow}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <div className="metric-value">{total}</div>
        <span style={{ color: '#7d8b95', fontSize: 12 }}>{total === 1 ? 'run' : 'runs'}</span>
      </div>
      <div className="bar-track" style={{ margin: '10px 0 12px' }} aria-hidden="true">
        <div className="bar-fill" style={{ width: total ? `${okPercent}%` : '0%', background: item.failure ? '#da9634' : '#15977e' }} />
      </div>
      {total === 0
        ? <span className="metric-foot">No runs yet</span>
        : item.failure
          ? <span className="badge priority-P1">{item.failure} failed</span>
          : <span className="badge status-resolved">All succeeded</span>}
    </div>;
  })}
</div>
    <div className="toolbar">
      <select className="select" aria-label="Filter by result" value={status} onChange={(e) => setStatus(e.target.value as '' | AutomationLogStatus)} data-testid="select-filter-automation-status"><option value="">All results</option><option value="success">Success</option><option value="failure">Failure</option></select>
      <select className="select" aria-label="Filter by workflow" value={workflow} onChange={(e) => setWorkflow(e.target.value)} data-testid="select-filter-automation-workflow"><option value="">All workflows</option>{summary.map((item) => <option key={item.workflow} value={item.workflow}>{workflowLabel[item.workflow] ?? item.workflow}</option>)}</select>
      {(status || workflow) && <button className="btn btn-small" onClick={() => { setStatus(''); setWorkflow(''); }}><X size={13} />Clear</button>}
      <button className="btn btn-small" onClick={() => logs.refetch()} disabled={logs.isFetching} data-testid="button-refresh-automation">{logs.isFetching ? 'Refreshing…' : 'Refresh'}</button>
    </div>
    <section className="panel">
      <div className="panel-head"><div><div className="panel-title">Workflow runs</div><div className="panel-kicker">{logs.data ? `${logs.data.logs.length} most recent runs in this view. Updates every 15 seconds.` : 'Loading runs…'}</div></div></div>
      {logs.isLoading ? <div style={{ padding: '10px 20px' }}>{[1, 2, 3].map((item) => <div className="skeleton" key={item} />)}</div>
        : logs.isError ? <div className="error-state"><h3>Automation logs could not be loaded</h3><p>Check your connection, then try again.</p><button className="btn btn-small" onClick={() => logs.refetch()}>Retry</button></div>
        : !logs.data?.logs.length ? <div className="empty-state"><h3>No workflow runs</h3><p>Runs appear here after a ticket is created, escalated or resolved.</p></div>
        : <div className="table-wrap"><table className="ticket-table" style={{ minWidth: 720 }}><thead><tr><th>Workflow</th><th>Ticket</th><th>Result</th><th>Error</th><th>Finished</th></tr></thead>
          <tbody>{logs.data.logs.map((log) => <tr key={log.id} data-testid={`row-automation-${log.id}`}>
            <td>{workflowLabel[log.workflow] ?? log.workflow}</td>
            <td>{log.ticketId ? <a href={`/tickets/${log.ticketId}`}>{log.ticketTitle ?? log.ticketId}</a> : <span style={{ color: '#9aa5ac' }}>—</span>}</td>
            <td><span className={`badge ${log.status === 'success' ? 'status-resolved' : 'priority-P1'}`}>{log.status === 'success' ? 'Success' : 'Failed'}</span></td>
            <td style={{ color: '#b64036', maxWidth: 280, fontSize: 12 }}>{log.errorSummary ?? ''}</td>
            <td className="mono" style={{ color: '#7d8b95' }}>{dateTime(log.finishedAt ?? log.createdAt)}</td>
          </tr>)}</tbody></table></div>}
    </section>
  </>;
}

export default function AdminPage({ user }: { user: User }) {
  const [tab, setTab] = useState<'users' | 'sla' | 'automation' | 'knowledge'>('users');
  if (user.role !== 'admin') {
    return <div className="content"><div className="panel"><div className="empty-state"><h3>Administrators only</h3><p>You do not have access to this area.</p></div></div></div>;
  }
  return <div className="content fade-in">
    <div className="page-heading"><div><div className="eyebrow">SERVICE DESK / ADMINISTRATION</div><h1 className="page-title">Administration</h1><p className="page-subtitle">Manage who can use the service desk and how quickly tickets must be answered.</p></div></div>
    <div role="tablist" aria-label="Administration sections" style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
      <button role="tab" aria-selected={tab === 'users'} className={`btn ${tab === 'users' ? 'btn-dark' : ''}`} onClick={() => setTab('users')} data-testid="tab-users">Users</button>
      <button role="tab" aria-selected={tab === 'sla'} className={`btn ${tab === 'sla' ? 'btn-dark' : ''}`} onClick={() => setTab('sla')} data-testid="tab-sla">SLA rules</button>
      <button role="tab" aria-selected={tab === 'automation'} className={`btn ${tab === 'automation' ? 'btn-dark' : ''}`} onClick={() => setTab('automation')} data-testid="tab-automation">Automation</button>
      <button role="tab" aria-selected={tab === 'knowledge'} className={`btn ${tab === 'knowledge' ? 'btn-dark' : ''}`} onClick={() => setTab('knowledge')} data-testid="tab-knowledge">Knowledge base</button>
    </div>
    {tab === 'users' ? <UsersPanel currentUserId={user.id} /> : tab === 'sla' ? <SlaPanel /> : tab === 'knowledge' ? <KnowledgeBasePage user={user} embedded /> : <AutomationPanel />}
  </div>;
}
