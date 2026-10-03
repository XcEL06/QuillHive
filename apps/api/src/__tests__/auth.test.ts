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

describe('Auth Routes', () => {
  it('POST /api/auth/register with missing fields returns 400', async () => {
    const res = await apiRequest('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@test.com' }),
    });
    expect([400, 422]).toContain(res.status);
  });

  it('rejects disposable email domains before creating an account', async () => {
    const res = await apiRequest('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'disposable-test-user',
        email: 'person@mailinator.com',
        password: 'a-strong-test-password',
        displayName: 'Disposable Test User',
      }),
    });

    expect(res.status).toBe(400);
    expect((res.body as any).error).toBe('Please use a permanent email address to register.');
  });

  it('POST /api/auth/login with wrong credentials returns 401 or 400', async () => {
    const res = await apiRequest('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'notreal@test.com', password: 'wrongpassword' }),
    });
    expect([400, 401]).toContain(res.status);
  });

  it('protected route without token returns 401', async () => {
    const res = await apiRequest('/api/admin/stats');
    expect([401, 403]).toContain(res.status);
  });

  it('GET /api/analytics/portfolio-views without token returns 401', async () => {
    const res = await apiRequest('/api/analytics/portfolio-views');
    expect([401, 403]).toContain(res.status);
  });

  it('accepts a multipart upload for authenticated users', async () => {
    const uniqueEmail = `upload-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
    const registerRes = await apiRequest('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: `upload${Date.now()}${Math.random().toString(36).slice(2, 8)}`,
        email: uniqueEmail,
        password: 'a-strong-test-password',
        displayName: 'Upload Test User',
      }),
    });

    expect(registerRes.status).toBe(201);

    const loginRes = await apiRequest('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: uniqueEmail, password: 'a-strong-test-password' }),
    });

    expect(loginRes.status).toBe(200);
    expect((loginRes.body as any).accessToken).toBeTruthy();

    const form = new FormData();
    form.append('file', new Blob(['hello upload world'], { type: 'text/plain' }), 'hello.txt');
    form.append('category', 'profile');

    const uploadRes = await apiRequest('/api/upload', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${(loginRes.body as any).accessToken}`,
      },
      body: form,
    });

    expect(uploadRes.status).toBe(201);
    expect((uploadRes.body as any).url).toMatch(/\/api\/file\//);
  });
});
