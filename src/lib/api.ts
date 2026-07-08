import type { PeopleMap, Sex, Tree, TreeSummary, User } from './types';

const BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
const TOKEN_KEY = 'shajara_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let res: Response;
  try {
    res = await fetch(`${BASE}/api${path}`, { ...options, headers });
  } catch {
    throw new ApiError(0, 'Не удалось связаться с сервером. Проверьте соединение.');
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const data = text ? safeJson(text) : {};

  if (!res.ok) {
    // An expired/invalid token: clear it so the app falls back to the public view.
    if (res.status === 401 && token) setToken(null);
    const message =
      (data && typeof data === 'object' && 'error' in data && (data as { error: string }).error) ||
      `Ошибка ${res.status}`;
    throw new ApiError(res.status, String(message));
  }
  return data as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

export interface AuthResult {
  token: string;
  user: User;
  firstTreeId?: number;
}

export const api = {
  // ---- auth ----
  register: (email: string, password: string) =>
    request<AuthResult>('/auth/register', { method: 'POST', body: JSON.stringify({ email, password }) }),
  login: (email: string, password: string) =>
    request<AuthResult>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  me: () => request<{ user: User }>('/auth/me'),

  // ---- public demo ----
  demo: () => request<{ tree: Tree }>('/demo'),

  // ---- trees ----
  listTrees: () => request<{ trees: TreeSummary[] }>('/trees'),
  getTree: (id: number) => request<{ tree: Tree }>(`/trees/${id}`),
  createTree: (title?: string, data?: { root: string; p: PeopleMap }) =>
    request<{ tree: Tree }>('/trees', { method: 'POST', body: JSON.stringify({ title, data }) }),
  renameTree: (id: number, title: string) =>
    request<{ tree: Tree }>(`/trees/${id}`, { method: 'PATCH', body: JSON.stringify({ title }) }),
  replaceTree: (id: number, data: { root: string; p: PeopleMap; title?: string }) =>
    request<{ tree: Tree }>(`/trees/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTree: (id: number) => request<void>(`/trees/${id}`, { method: 'DELETE' }),

  // ---- persons ----
  addPerson: (treeId: number, anchorId: string, name: string, sex: Sex, asSpouse = false) =>
    request<{ personId: string; tree: Tree }>(`/trees/${treeId}/persons`, {
      method: 'POST',
      body: JSON.stringify({ anchorId, name, sex, asSpouse }),
    }),
  updatePerson: (
    treeId: number,
    pid: string,
    patch: { name?: string; sex?: Sex; b?: string; d?: string; origin?: string },
  ) =>
    request<{ tree: Tree }>(`/trees/${treeId}/persons/${pid}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  deletePerson: (treeId: number, pid: string) =>
    request<{ removed: number; tree: Tree }>(`/trees/${treeId}/persons/${pid}`, { method: 'DELETE' }),
};
