const API_BASE = '/api/v1';

async function request<T = unknown>(method: string, path: string, body?: unknown, token?: string | null): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? `HTTP ${res.status}`);
  return data;
}

export const api = {
  get: <T = unknown>(path: string, token?: string | null) => request<T>('GET', path, undefined, token),
  post: <T = unknown>(path: string, body: unknown, token?: string | null) => request<T>('POST', path, body, token),
  patch: <T = unknown>(path: string, body: unknown, token?: string | null) => request<T>('PATCH', path, body, token),
};
