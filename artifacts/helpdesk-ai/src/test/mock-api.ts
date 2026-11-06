import { vi } from 'vitest';

export type Call = { method: string; path: string; body: unknown };
type Reply = { status?: number; json?: unknown };
type Route = (body: unknown) => Reply;

function jsonResponse(status: number, json: unknown) {
  return new Response(JSON.stringify(json), { status, headers: { 'content-type': 'application/json' } });
}

export function mockApi(routes: Record<string, Route>): Call[] {
  const calls: Call[] = [];
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : null;
    const path = new URL(request ? request.url : String(input), 'http://localhost').pathname;
    const method = (init?.method ?? request?.method ?? 'GET').toUpperCase();
    const text = typeof init?.body === 'string' ? init.body : request ? await request.clone().text() : '';
    let body: unknown;
    if (text) { try { body = JSON.parse(text); } catch { body = text; } }
    calls.push({ method, path, body });

    const route = routes[`${method} ${path}`];
    if (!route) return jsonResponse(404, { error: `No mock for ${method} ${path}` });
    const reply = route(body);
    return jsonResponse(reply.status ?? 200, reply.json ?? null);
  }));
  return calls;
}