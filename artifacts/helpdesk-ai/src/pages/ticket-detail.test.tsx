import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { TicketStatus, User } from '@workspace/api-client-react';
import { TicketDetailPage } from '@/pages/ticket-detail';
import { mockApi } from '@/test/mock-api';
import { renderAt } from '@/test/utils';

const requester: User = { id: 'u-req', fullName: 'Nora Requester', email: 'nora@test.local', role: 'requester', initials: 'NR' };
const agent: User = { id: 'u-agent', fullName: 'Alex Agent', email: 'alex@test.local', role: 'agent', initials: 'AA' };

function ticket(status: TicketStatus) {
  return {
    id: 't1', title: 'Printer jammed', description: 'The shared printer shows a paper jam.',
    category: 'Hardware', priority: 'P3', status, requester, assignedAgent: agent,
    createdAt: '2026-11-06T10:00:00.000Z', updatedAt: '2026-11-06T10:00:00.000Z',
    slaDeadline: '2026-11-06T18:00:00.000Z',
    resolvedAt: status === 'resolved' || status === 'closed' ? '2026-11-06T12:00:00.000Z' : null,
    commentsCount: 0, slaPercent: 20, slaState: 'on_track', comments: [],
  };
}

/** A tiny stateful fake API: the PATCH really changes what the next GET returns. */
function ticketApi(initial: TicketStatus, patchStatus = 200) {
  let status = initial;
  return mockApi({
    'GET /api/tickets/t1': () => ({ json: ticket(status) }),
    'PATCH /api/tickets/t1/status': (body) => {
      if (patchStatus !== 200) return { status: patchStatus, json: { error: 'Invalid status change.' } };
      status = (body as { status: TicketStatus }).status;
      return { json: ticket(status) };
    },
  });
}

const optionValues = (select: HTMLElement) =>
  within(select).getAllByRole('option').map((option) => (option as HTMLOptionElement).value);

describe('updating ticket status', () => {
  it('offers an agent only the next step in the lifecycle', async () => {
    ticketApi('assigned');
    renderAt(<TicketDetailPage user={agent} />, '/tickets/t1');
    const select = await screen.findByTestId('select-update-status');
    expect(optionValues(select)).toEqual(['assigned', 'in_progress']);
  });

  it('lets an agent move a ticket to in progress', async () => {
    const calls = ticketApi('assigned');
    const user = userEvent.setup();
    renderAt(<TicketDetailPage user={agent} />, '/tickets/t1');

    await user.selectOptions(await screen.findByTestId('select-update-status'), 'in_progress');

    expect(await screen.findByTestId('text-ticket-action-success')).toHaveTextContent('Status updated.');
    const patch = calls.find((c) => c.method === 'PATCH');
    expect(patch?.path).toBe('/api/tickets/t1/status');
    expect(patch?.body).toEqual({ status: 'in_progress' });
    await waitFor(() => expect(screen.getByTestId('select-update-status')).toHaveValue('in_progress'));
  });

  it('offers nothing further once a ticket is closed', async () => {
    ticketApi('closed');
    renderAt(<TicketDetailPage user={agent} />, '/tickets/t1');
    const select = await screen.findByTestId('select-update-status');
    expect(optionValues(select)).toEqual(['closed']);
  });

  it('shows an error when the server refuses the change', async () => {
    ticketApi('assigned', 409);
    const user = userEvent.setup();
    renderAt(<TicketDetailPage user={agent} />, '/tickets/t1');

    await user.selectOptions(await screen.findByTestId('select-update-status'), 'in_progress');

    expect(await screen.findByTestId('text-ticket-action-error')).toBeInTheDocument();
    expect(screen.queryByTestId('text-ticket-action-success')).not.toBeInTheDocument();
  });

  it('lets a requester close a resolved ticket, but gives them no status menu', async () => {
    const calls = ticketApi('resolved');
    const user = userEvent.setup();
    renderAt(<TicketDetailPage user={requester} />, '/tickets/t1');

    const close = await screen.findByTestId('button-close-ticket');
    expect(screen.queryByTestId('select-update-status')).not.toBeInTheDocument();
    await user.click(close);

    expect(await screen.findByTestId('text-ticket-action-success')).toBeInTheDocument();
    expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ status: 'closed' });
  });

  it('does not let a requester close a ticket that is not resolved', async () => {
    ticketApi('in_progress');
    renderAt(<TicketDetailPage user={requester} />, '/tickets/t1');
    await screen.findByTestId('text-ticket-title');
    expect(screen.queryByTestId('button-close-ticket')).not.toBeInTheDocument();
  });
});