const API_BASE = '/api/v1';

interface AuthState {
  token: string | null;
}

async function request<T = unknown>(
  method: string,
  path: string,
  body?: unknown,
  auth?: AuthState
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (auth?.token) {
    headers['Authorization'] = `Bearer ${auth.token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message ?? `HTTP ${res.status}`);
  }
  return data;
}

export const api = {
  get: <T = unknown>(path: string, auth?: AuthState) => request<T>('GET', path, undefined, auth),
  post: <T = unknown>(path: string, body: unknown, auth?: AuthState) => request<T>('POST', path, body, auth),
  patch: <T = unknown>(path: string, body: unknown, auth?: AuthState) => request<T>('PATCH', path, body, auth),
};
