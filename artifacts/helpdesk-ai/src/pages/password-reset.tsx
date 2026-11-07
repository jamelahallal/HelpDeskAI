import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { useForgotPassword, useResetPassword } from '@workspace/api-client-react';
import { Brand } from '@/components/common';

function apiError(err: unknown, fallback: string): string {
  const text = (err as { data?: { error?: unknown } }).data?.error;
  return typeof text === 'string' ? text : fallback;
}

function Shell({ eyebrow, title, intro, children }: { eyebrow: string; title: string; intro: string; children: React.ReactNode }) {
  return <div className="auth-page">
    <section className="auth-art"><Brand /><div className="auth-copy"><div className="eyebrow" style={{ color: '#76cdbb' }}>IT SERVICE OPERATIONS / 01</div><h1>Support that<br />moves work forward.</h1><p>One clear path from request to resolution. Know who owns the next step, and when it’s due.</p><div className="auth-stat">ACCOUNTABLE SUPPORT · MEASURABLE SERVICE</div></div><div style={{ color: '#92a4ae', fontSize: 11 }}>HelpDeskAI · Service desk workspace</div></section>
    <section className="auth-form-side"><div className="auth-card fade-in">
      <div className="eyebrow">{eyebrow}</div>
      <h2>{title}</h2>
      <p>{intro}</p>
      {children}
      <div style={{ textAlign: 'center', marginTop: 32, color: '#9aa5ac', fontSize: 10 }}><ShieldCheck size={13} style={{ verticalAlign: 'middle', marginRight: 5 }} />Protected service desk access</div>
    </div></section>
  </div>;
}

export function ForgotPassword() {
  const forgot = useForgotPassword();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  const submit = (event: React.FormEvent) => {
    event.preventDefault(); setError('');
    forgot.mutate({ data: { email: email.trim() } }, {
      onError: (err: unknown) => setError(apiError(err, 'We could not send the request. Please try again.')),
    });
  };

  return <Shell eyebrow="ACCOUNT RECOVERY" title="Forgot your password?" intro="Enter your work email and we’ll send you a link to choose a new one.">
    {error && <div role="alert" className="form-error" data-testid="text-forgot-error">{error}</div>}
    {forgot.isSuccess
      ? <div className="success-note" data-testid="text-forgot-success">If an account exists for that email, a reset link is on its way. It works once and expires in 1 hour.</div>
      : <form onSubmit={submit}>
        <div className="form-group"><label className="form-label" htmlFor="email">Work email</label><input className="field" id="email" type="email" autoComplete="email" maxLength={254} required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" data-testid="input-forgot-email" /></div>
        <button className="btn btn-primary" type="submit" disabled={forgot.isPending} data-testid="button-forgot-submit">{forgot.isPending ? 'Sending…' : 'Send reset link'}{!forgot.isPending && <ArrowRight size={15} />}</button>
      </form>}
    <div className="auth-switch"><Link href="/login" data-testid="link-back-login">Back to sign in</Link></div>
  </Shell>;
}

export function ResetPassword() {
  const reset = useResetPassword();
  const [token] = useState(() => new URLSearchParams(window.location.search).get('token') ?? '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');

  // Keep the token out of the address bar, browser history and any Referer header.
  useEffect(() => {
    if (window.location.search) window.history.replaceState(null, '', window.location.pathname);
  }, []);

  const submit = (event: React.FormEvent) => {
    event.preventDefault(); setError('');
    if (password !== confirm) { setError('The two passwords do not match.'); return; }
    reset.mutate({ data: { token, password } }, {
      onError: (err: unknown) => setError(apiError(err, 'We could not change your password. Please request a new link.')),
    });
  };

  return <Shell eyebrow="ACCOUNT RECOVERY" title="Choose a new password" intro="Use at least 10 characters.">
    {error && <div role="alert" className="form-error" data-testid="text-reset-error">{error}</div>}
    {reset.isSuccess
      ? <>
        <div className="success-note" data-testid="text-reset-success">Your password has been changed.</div>
        <div className="auth-switch"><Link href="/login" data-testid="link-reset-login">Sign in with your new password</Link></div>
      </>
      : !token
        ? <>
          <div role="alert" className="form-error" data-testid="text-reset-missing">This reset link is incomplete. Request a new one.</div>
          <div className="auth-switch"><Link href="/forgot-password" data-testid="link-request-new">Request a new link</Link></div>
        </>
        : <>
          <form onSubmit={submit}>
            <div className="form-group"><label className="form-label" htmlFor="password">New password</label><input className="field" id="password" type="password" autoComplete="new-password" minLength={10} maxLength={128} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 10 characters" data-testid="input-reset-password" /></div>
            <div className="form-group"><label className="form-label" htmlFor="confirm">Confirm new password</label><input className="field" id="confirm" type="password" autoComplete="new-password" minLength={10} maxLength={128} required value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repeat the password" data-testid="input-reset-confirm" /></div>
            <button className="btn btn-primary" type="submit" disabled={reset.isPending} data-testid="button-reset-submit">{reset.isPending ? 'Saving…' : 'Change password'}{!reset.isPending && <ArrowRight size={15} />}</button>
          </form>
          <div className="auth-switch"><Link href="/forgot-password" data-testid="link-request-new">Request a new link</Link></div>
        </>}
  </Shell>;
}