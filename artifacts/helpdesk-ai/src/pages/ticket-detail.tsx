import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, useRoute } from 'wouter';
import { ArrowLeft, MessageSquare, Send } from 'lucide-react';
import {
  getGetDashboardSummaryQueryKey, getGetTicketQueryKey, getListAgentsQueryKey, getListTicketsQueryKey,
  useCreateTicketComment, useGetTicket, useListAgents, useUpdateTicketAssignment,
  useUpdateTicketPriority, useUpdateTicketStatus,
} from '@workspace/api-client-react';
import type { TicketDetail, TicketPriority, TicketStatus, User } from '@workspace/api-client-react';
import { Avatar, Empty, PriorityBadge, Problem, StatusBadge } from '@/components/common';
import { AiAnalysisCard, type AiAnalysis } from '@/components/ai-analysis-card';
import { ago, dateLabel, titleCase } from '@/lib/format';
import { priorities, statusText } from '@/lib/ticket-constants';
import { FeedbackCard } from '@/components/feedback-card';

export function TicketDetailPage({ user }: { user: User }) {
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
        <FeedbackCard ticketId={ticket.id} status={ticket.status} role={user.role} />
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
