import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Star } from 'lucide-react';
import { getGetTicketFeedbackQueryKey, useGetTicketFeedback, useSubmitTicketFeedback } from '@workspace/api-client-react';
import type { TicketStatus, UserRole } from '@workspace/api-client-react';

function Stars({ value, onPick }: { value: number; onPick?: (n: number) => void }) {
  const star = (n: number) => <Star size={20} fill={n <= value ? '#da9634' : 'none'} color={n <= value ? '#da9634' : '#b4bec5'} />;
  if (!onPick) return <div role="img" aria-label={`${value} out of 5 stars`} style={{ display: 'flex', gap: 4 }}>{[1, 2, 3, 4, 5].map((n) => <span key={n}>{star(n)}</span>)}</div>;
  return <div role="radiogroup" aria-label="Rating" style={{ display: 'flex', gap: 4 }}>
    {[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} ${n === 1 ? 'star' : 'stars'}`} onClick={() => onPick(n)} style={{ background: 'none', border: 0, padding: 2, cursor: 'pointer' }} data-testid={`button-rating-${n}`}>{star(n)}</button>)}
  </div>;
}

export function FeedbackCard({ ticketId, status, role }: { ticketId: string; status: TicketStatus; role: UserRole }) {
  const client = useQueryClient();
  const finished = status === 'resolved' || status === 'closed';
  const feedback = useGetTicketFeedback(ticketId, { query: { enabled: finished, queryKey: getGetTicketFeedbackQueryKey(ticketId) } });
  const submit = useSubmitTicketFeedback();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');

  if (!finished || feedback.isLoading || feedback.isError) return null;
  const saved = feedback.data?.feedback ?? null;
  if (!saved && role !== 'requester') return null;

  const send = (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    submit.mutate({ ticketId, data: { rating, ...(comment.trim() ? { comment: comment.trim() } : {}) } }, {
      onSuccess: () => client.invalidateQueries({ queryKey: getGetTicketFeedbackQueryKey(ticketId) }),
      onError: (err) => {
        const text = (err as { data?: { error?: unknown } }).data?.error;
        setError(typeof text === 'string' ? text : 'Your rating could not be saved. Please try again.');
      },
    });
  };

  return <section className="panel" style={{ marginTop: 16 }} data-testid="panel-feedback">
    <div className="panel-head"><div><div className="panel-title">{saved ? (role === 'requester' ? 'Thanks for your feedback' : 'Requester feedback') : 'How did we do?'}</div>
      <div className="panel-kicker">{saved ? 'One rating per ticket.' : 'Rate how this request was handled.'}</div></div></div>
    <div style={{ padding: '0 21px 20px' }}>
      {saved ? <>
        <Stars value={saved.rating} />
        {saved.comment && <p className="detail-description" style={{ marginBottom: 0 }} data-testid="text-feedback-comment">{saved.comment}</p>}
      </> : <form onSubmit={send}>
        <Stars value={rating} onPick={setRating} />
        <label className="form-label" htmlFor="feedback-comment" style={{ marginTop: 12 }}>Anything to add? (optional)</label>
        <textarea id="feedback-comment" className="textarea" maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)} data-testid="input-feedback-comment" />
        {error && <div className="form-error" style={{ marginTop: 10 }} data-testid="text-feedback-error">{error}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
          <button type="submit" className="btn btn-primary btn-small" disabled={!rating || submit.isPending} data-testid="button-submit-feedback">{submit.isPending ? 'Sending…' : 'Send rating'}</button>
        </div>
      </form>}
    </div>
  </section>;
}