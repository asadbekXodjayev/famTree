import type {
  Collaborator,
  Invite,
  PeopleMap,
  PendingProposal,
  Relation,
  Sex,
  Tree,
  TreeRole,
  TreeSummary,
  User,
  VersionSummary,
} from './types';

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
  getTree: (id: number) => request<{ tree: Tree; role?: TreeRole }>(`/trees/${id}`),
  createTree: (title?: string, data?: { root: string; p: PeopleMap }) =>
    request<{ tree: Tree }>('/trees', { method: 'POST', body: JSON.stringify({ title, data }) }),
  renameTree: (id: number, title: string) =>
    request<{ tree: Tree }>(`/trees/${id}`, { method: 'PATCH', body: JSON.stringify({ title }) }),
  replaceTree: (id: number, data: { root: string; p: PeopleMap; title?: string }) =>
    request<{ tree: Tree }>(`/trees/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTree: (id: number) => request<void>(`/trees/${id}`, { method: 'DELETE' }),

  // ---- persons ----
  addRelative: (treeId: number, anchorId: string, relation: Relation, name: string, sex: Sex) =>
    request<{ personId: string; tree: Tree }>(`/trees/${treeId}/persons`, {
      method: 'POST',
      body: JSON.stringify({ anchorId, name, sex, relation }),
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

  // ---- photos ----
  addPhoto: (treeId: number, pid: string, dataUrl: string) =>
    request<{ tree: Tree }>(`/trees/${treeId}/persons/${pid}/photos`, {
      method: 'POST',
      body: JSON.stringify({ dataUrl }),
    }),
  removePhoto: (treeId: number, pid: string, index: number) =>
    request<{ tree: Tree }>(`/trees/${treeId}/persons/${pid}/photos/${index}`, { method: 'DELETE' }),

  // ---- collaborators & invites ----
  listCollaborators: (treeId: number) =>
    request<{ collaborators: Collaborator[] }>(`/trees/${treeId}/collaborators`),
  removeCollaborator: (treeId: number, userId: number) =>
    request<void>(`/trees/${treeId}/collaborators/${userId}`, { method: 'DELETE' }),
  createInvite: (treeId: number) =>
    request<{ token: string }>(`/trees/${treeId}/invites`, { method: 'POST' }),
  listInvites: (treeId: number) => request<{ invites: Invite[] }>(`/trees/${treeId}/invites`),
  revokeInvite: (treeId: number, inviteId: number) =>
    request<void>(`/trees/${treeId}/invites/${inviteId}`, { method: 'DELETE' }),
  previewInvite: (token: string) =>
    request<{ treeId: number; title: string; ownerEmail: string }>(`/invites/${token}`),
  acceptInvite: (token: string) =>
    request<{ treeId: number }>(`/invites/${token}/accept`, { method: 'POST' }),

  // ---- versions ----
  listVersions: (treeId: number) =>
    request<{ versions: VersionSummary[] }>(`/trees/${treeId}/versions`),
  getVersion: (treeId: number, vid: number) =>
    request<{ tree: Tree }>(`/trees/${treeId}/versions/${vid}`),
  restoreVersion: (treeId: number, vid: number) =>
    request<{ tree: Tree }>(`/trees/${treeId}/versions/${vid}/restore`, { method: 'POST' }),
  checkpoint: (treeId: number, note?: string) =>
    request<{ versions: VersionSummary[] }>(`/trees/${treeId}/versions`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    }),

  // ---- proposals ----
  getDraft: (treeId: number) =>
    request<{ proposal: { id: number; status: string; data: Tree; note: string | null } | null }>(
      `/trees/${treeId}/proposals/draft`,
    ),
  saveDraft: (treeId: number, data: { root: string; p: PeopleMap }) =>
    request<{ ok: true }>(`/trees/${treeId}/proposals/draft`, {
      method: 'PUT',
      body: JSON.stringify({ data }),
    }),
  submitProposal: (treeId: number, data: { root: string; p: PeopleMap }, note?: string) =>
    request<{ proposalId: number }>(`/trees/${treeId}/proposals`, {
      method: 'POST',
      body: JSON.stringify({ data, note }),
    }),
  listProposals: (treeId: number) =>
    request<{ proposals: PendingProposal[] }>(`/trees/${treeId}/proposals`),
  getProposal: (pid: number) =>
    request<{
      proposal: { id: number; treeId: number; status: string; note: string | null; data: Tree };
    }>(`/proposals/${pid}`),
  acceptProposal: (pid: number) =>
    request<{ tree: Tree }>(`/proposals/${pid}/accept`, { method: 'POST' }),
  rejectProposal: (pid: number) => request<void>(`/proposals/${pid}/reject`, { method: 'POST' }),
};
