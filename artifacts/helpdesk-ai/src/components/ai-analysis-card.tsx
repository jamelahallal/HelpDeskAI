import { useState } from 'react';
import { Copy, Sparkles } from 'lucide-react';
import type { TicketPriority } from '@workspace/api-client-react';
import { PriorityBadge } from '@/components/common';
import { dateLabel } from '@/lib/format';

export type AiAnalysis = {
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

export function AiAnalysisCard({ ai, currentPriority, currentCategory, onUseReply, onApplyPriority, applying }: {
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
