import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useLocation } from 'wouter';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { getGetCurrentUserQueryKey, useLoginUser, useRegisterUser } from '@workspace/api-client-react';
import { Brand } from '@/components/common';

export function SignIn({ register = false }: { register?: boolean }) {
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
