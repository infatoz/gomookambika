const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1';

export interface UserInfo {
  id?: string;
  _id?: string;
  name?: string;
  phone: string;
  email?: string;
  role?: string;
  profilePhoto?: string;
}

export interface AuthState {
  token: string | null;
  user?: UserInfo | null;
}

async function request<T = unknown>(
  method: string,
  path: string,
  body?: unknown,
  auth?: AuthState | string | null
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const token =
    typeof auth === 'string'
      ? auth
      : auth?.token ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('gm_token') : null);

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let data: any = null;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    data = await res.json().catch(() => null);
  } else {
    const text = await res.text().catch(() => '');
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text || `HTTP ${res.status}` };
    }
  }

  if (res.status === 401 || res.status === 403) {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('gm_token');
      localStorage.removeItem('gm_user');
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    }
  }

  if (!res.ok) {
    throw new Error(data?.message ?? data?.error ?? `HTTP ${res.status}`);
  }
  return data;
}

export const api = {
  get: <T = unknown>(path: string, auth?: AuthState | string | null) =>
    request<T>('GET', path, undefined, auth),
  post: <T = unknown>(path: string, body?: unknown, auth?: AuthState | string | null) =>
    request<T>('POST', path, body, auth),
  patch: <T = unknown>(path: string, body?: unknown, auth?: AuthState | string | null) =>
    request<T>('PATCH', path, body, auth),
  delete: <T = unknown>(path: string, auth?: AuthState | string | null) =>
    request<T>('DELETE', path, undefined, auth),
  uploadPhoto: async <T = unknown>(file: File, auth?: AuthState | string | null): Promise<T> => {
    const token =
      typeof auth === 'string'
        ? auth
        : auth?.token ||
          (typeof localStorage !== 'undefined' ? localStorage.getItem('gm_token') : null);

    const formData = new FormData();
    formData.append('photo', file);

    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}/auth/upload-photo`, {
      method: 'POST',
      headers,
      body: formData,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(data?.message || 'Failed to upload profile photo');
    }
    return data;
  },
};
