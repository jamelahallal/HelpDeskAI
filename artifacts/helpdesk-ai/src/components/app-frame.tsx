import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useLocation } from 'wouter';
import { ArrowRight, BookOpen, Headphones, LayoutDashboard, LogOut, ShieldCheck, Ticket as TicketIcon } from 'lucide-react';
import { useLogoutUser } from '@workspace/api-client-react';
import type { User } from '@workspace/api-client-react';
import { Avatar } from '@/components/common';

export function AppFrame({ user, children }: { user: User; children: React.ReactNode }) {
  const [path, navigate] = useLocation();
  const isActive = (href: string) =>
  href === '/' ? path === '/' : path === href || path.startsWith(`${href}/`);
  const logout = useLogoutUser();
  const client = useQueryClient();
  const [error, setError] = useState('');
  const signOut = () => logout.mutate(undefined, { onSuccess: () => { client.clear(); navigate('/login'); }, onError: () => setError('Sign out did not complete. Please try again.') });
  const nav = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/tickets', label: 'Tickets', icon: TicketIcon },
  ...(user.role === 'admin'
    ? [
        { href: '/knowledge-base', label: 'Knowledge base', icon: BookOpen },
        { href: '/admin', label: 'Admin', icon: ShieldCheck },
      ]
    : []),
];
  return <div className="app-shell">
    <aside className="sidebar">
      <Link href="/" className="brand" data-testid="link-brand"><span className="brand-mark"><Headphones size={17} /></span><span>helpdesk<span style={{ color: '#54c9b0' }}>ai</span></span></Link>
      <div className="nav-wrap">
        <div className="nav-label">Workspace</div>
        <nav className="nav-list">{nav.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={`nav-item ${isActive(href) ? 'active' : ''}`} data-testid={`link-nav-${label.toLowerCase().replace(/\s+/g, '-')}`}><Icon size={17} /><span>{label}</span></Link>)}</nav>
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
