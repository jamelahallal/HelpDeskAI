import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Router } from 'wouter';
import { memoryLocation } from 'wouter/memory-location';

export function renderAt(ui: React.ReactElement, path = '/') {
  const { hook } = memoryLocation({ path });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <Router hook={hook}>{ui}</Router>
    </QueryClientProvider>,
  );
}