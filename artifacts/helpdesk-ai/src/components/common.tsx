import { AlertCircle, CircleHelp, Headphones } from 'lucide-react';
import type { TicketPriority, TicketStatus, User } from '@workspace/api-client-react';
import { statusText } from '@/lib/ticket-constants';

export function Avatar({ user }: { user: User }) { return <div className="avatar" data-testid={`avatar-user-${user.id}`}>{user.initials}</div>; }
export function StatusBadge({ status }: { status: TicketStatus }) { return <span className={`badge status-${status}`} data-testid={`status-ticket-${status}`}>{statusText[status]}</span>; }
export function PriorityBadge({ priority }: { priority: TicketPriority }) { return <span className={`badge priority-${priority}`} data-testid={`priority-ticket-${priority}`}>{priority}</span>; }
export function LoadRows() { return <div style={{ padding: '10px 20px' }} aria-label="Loading tickets">{[1, 2, 3, 4].map((item) => <div className="skeleton" key={item} />)}</div>; }
export function Problem({ retry, text = 'We couldn’t load this information.' }: { retry: () => void; text?: string }) {
  return <div className="error-state"><div className="empty-icon"><AlertCircle size={19} /></div><h3>Something needs a second try</h3><p>{text}</p><button className="btn btn-small" onClick={retry} data-testid="button-retry">Try again</button></div>;
}
export function Empty({ title, detail, action }: { title: string; detail: string; action?: React.ReactNode }) {
  return <div className="empty-state"><div className="empty-icon"><CircleHelp size={20} /></div><h3>{title}</h3><p>{detail}</p>{action}</div>;
}
export function Brand() { return <div className="brand"><span className="brand-mark"><Headphones size={17} /></span><span>helpdesk<span style={{ color: '#54c9b0' }}>ai</span></span></div>; }
