import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import app from '../app';

let baseUrl = 'http://127.0.0.1:0';
let server: ReturnType<typeof app.listen> | undefined;

beforeAll(async () => {
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => {
    server!.once('listening', () => resolve());
  });

  const address = server.address();
  if (typeof address === 'object' && address) {
    baseUrl = `http://127.0.0.1:${address.port}`;
  }
});

afterAll(async () => {
  if (server) {
    await new Promise<void>((resolve, reject) => {
      server!.close((err) => (err ? reject(err) : resolve()));
    });
  }
});

async function apiRequest(path: string, init?: RequestInit) {
  const response = await fetch(`${baseUrl}${path}`, init);
  const text = await response.text();

  let body: unknown = text;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      // leave raw text for non-JSON responses
    }
  }

  return { status: response.status, body, headers: response.headers };
}

describe('Health Check', () => {
  it('GET /api/healthz reports database readiness', async () => {
    const res = await apiRequest('/api/healthz');
    expect([200, 503]).toContain(res.status);
    expect((res.body as { checks?: { database?: string } }).checks?.database).toBe(res.status === 200 ? 'ok' : 'fail');
  });
});
