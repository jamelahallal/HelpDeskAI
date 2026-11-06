import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TicketCreate } from '@/components/ticket-create';
import { mockApi } from '@/test/mock-api';
import { renderAt } from '@/test/utils';

const created = { id: 't1', title: 'VPN will not connect', priority: 'P2' };

async function fillForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByTestId('input-ticket-title'), 'VPN will not connect');
  await user.type(screen.getByTestId('input-ticket-description'), 'It says authentication failed from home.');
  await user.type(screen.getByTestId('input-ticket-category'), 'Access');
  await user.selectOptions(screen.getByTestId('select-ticket-priority'), 'P2');
}

describe('creating a ticket', () => {
  it('sends the entered details and reports the new ticket', async () => {
    const calls = mockApi({ 'POST /api/tickets': () => ({ status: 201, json: created }) });
    const onCreated = vi.fn();
    const user = userEvent.setup();
    renderAt(<TicketCreate close={vi.fn()} onCreated={onCreated} />);

    await fillForm(user);
    await user.click(screen.getByTestId('button-submit-ticket'));

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ id: 't1' })));
    const post = calls.find((c) => c.method === 'POST' && c.path === '/api/tickets');
    expect(post?.body).toEqual({
      title: 'VPN will not connect',
      description: 'It says authentication failed from home.',
      category: 'Access',
      priority: 'P2',
    });
  });

  it('defaults to normal priority (P3)', () => {
    mockApi({});
    renderAt(<TicketCreate close={vi.fn()} onCreated={vi.fn()} />);
    expect(screen.getByTestId('select-ticket-priority')).toHaveValue('P3');
  });

  it('does not send an empty form', async () => {
    const calls = mockApi({ 'POST /api/tickets': () => ({ status: 201, json: created }) });
    const user = userEvent.setup();
    renderAt(<TicketCreate close={vi.fn()} onCreated={vi.fn()} />);

    await user.click(screen.getByTestId('button-submit-ticket'));
    expect(calls).toHaveLength(0);
  });

  it('shows an error and stays open when the server rejects the ticket', async () => {
    mockApi({ 'POST /api/tickets': () => ({ status: 400, json: { error: 'Invalid ticket.' } }) });
    const onCreated = vi.fn();
    const user = userEvent.setup();
    renderAt(<TicketCreate close={vi.fn()} onCreated={onCreated} />);

    await fillForm(user);
    await user.click(screen.getByTestId('button-submit-ticket'));

    expect(await screen.findByTestId('text-create-error')).toBeInTheDocument();
    expect(onCreated).not.toHaveBeenCalled();
  });

  it('closes from the cancel button', async () => {
    mockApi({});
    const close = vi.fn();
    const user = userEvent.setup();
    renderAt(<TicketCreate close={close} onCreated={vi.fn()} />);
    await user.click(screen.getByTestId('button-cancel-create'));
    expect(close).toHaveBeenCalled();
  });
});