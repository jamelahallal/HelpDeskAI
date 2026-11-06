import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight, X } from 'lucide-react';
import { getGetDashboardSummaryQueryKey, getListTicketsQueryKey, useCreateTicket } from '@workspace/api-client-react';
import type { Ticket, TicketPriority } from '@workspace/api-client-react';
import { priorities } from '@/lib/ticket-constants';

export function TicketCreate({ close, onCreated }: { close: () => void; onCreated: (ticket: Ticket) => void }) {
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
