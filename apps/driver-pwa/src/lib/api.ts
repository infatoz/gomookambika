const API_BASE = '/api/v1';

async function request<T = unknown>(method: string, path: string, body?: unknown, token?: string | null): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  
  // Auto-resolve token if not explicitly provided or passed as null/empty
  const activeToken =
    token !== undefined && token !== null
      ? token
      : typeof localStorage !== 'undefined'
      ? localStorage.getItem('gm_driver_token')
      : null;

  if (activeToken) {
    headers['Authorization'] = `Bearer ${activeToken}`;
  }
  
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    throw new Error('Unable to connect to server. Please check your network connection.');
  }

  let data: any = null;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      data = await res.json();
    } catch {
      data = null;
    }
  } else {
    const text = await res.text().catch(() => '');
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { message: text.length < 150 ? text : `Server returned error (${res.status})` };
      }
    }
  }

  // Handle Unauthorized (401)
  if (res.status === 401) {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('gm_driver_token');
      localStorage.removeItem('gm_driver');
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    }
    const errMsg = data?.message || 'Session expired or unauthorized. Please log in again.';
    throw new Error(errMsg);
  }

  if (!res.ok) {
    const errMsg = data?.message || data?.error || `HTTP ${res.status}: ${res.statusText || 'Request failed'}`;
    throw new Error(errMsg);
  }

  return data as T;
}

export const api = {
  get: <T = unknown>(path: string, token?: string | null) => request<T>('GET', path, undefined, token),
  post: <T = unknown>(path: string, body: unknown, token?: string | null) => request<T>('POST', path, body, token),
  patch: <T = unknown>(path: string, body: unknown, token?: string | null) => request<T>('PATCH', path, body, token),
};
