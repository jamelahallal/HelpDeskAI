import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { getGetCurrentUserQueryKey, useGetCurrentUser } from '@workspace/api-client-react';
import type { User } from '@workspace/api-client-react';
import { Brand } from '@/components/common';
import { AppFrame } from '@/components/app-frame';
import { SignIn } from '@/pages/sign-in';

export function Protected({ children }: { children: (user: User) => React.ReactNode }) {
  const [where, go] = useLocation();
  const current = useGetCurrentUser({ query: { queryKey: getGetCurrentUserQueryKey(), retry: false } });
  useEffect(() => { if (current.isError) go('/login'); }, [current.isError, go]);
  if (current.isLoading || (!current.data && !current.isError)) return <div className="auth-page"><div className="auth-art"><Brand /><div className="auth-copy"><h1>Every issue,<br />owned.</h1><p>Clear requests, visible service levels, and accountable resolution.</p></div><div className="auth-stat">SERVICE DESK / SECURE WORKSPACE</div></div><div className="auth-form-side"><div className="auth-card"><div className="skeleton" /><div className="skeleton" /><div className="skeleton" /></div></div></div>;
  if (current.isError) return <SignIn />;
  return <AppFrame user={current.data!}>{children(current.data!)}</AppFrame>;
}
