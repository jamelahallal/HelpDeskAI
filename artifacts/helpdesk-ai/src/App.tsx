import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Route, Switch, useLocation } from 'wouter';
import NotFound from '@/pages/not-found';
import AdminPage from '@/pages/admin';
import { SignIn } from '@/pages/sign-in';
import { Dashboard } from '@/pages/dashboard';
import { TicketsPage } from '@/pages/tickets';
import { TicketDetailPage } from '@/pages/ticket-detail';
import { Protected } from '@/components/protected';
import { ForgotPassword, ResetPassword } from '@/pages/password-reset';
import { KnowledgeBasePage } from '@/pages/knowledge-base';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } });

function Router() {
  const [location] = useLocation();
  if (location === '/login') return <SignIn />;
  if (location === '/register') return <SignIn register />;
  if (location === '/forgot-password') return <ForgotPassword />;
  if (location === '/reset-password') return <ResetPassword />;
  return <Protected>{(user) => <Switch>
    <Route path="/" component={() => <Dashboard user={user} />} />
    <Route path="/tickets" component={TicketsPage} />
    <Route path="/tickets/:ticketId" component={() => <TicketDetailPage user={user} />} />
    <Route path="/knowledge-base" component={() => <KnowledgeBasePage user={user} />} />
    <Route path="/admin" component={() => <AdminPage user={user} />} />
    <Route component={NotFound} />
  </Switch>}</Protected>;
}
function App() {
  return <QueryClientProvider client={queryClient}><Router /></QueryClientProvider>;
}

export default App;
