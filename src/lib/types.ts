/** Photos per person. Mirrored by MAX_PHOTOS in the backend's treeOps.ts. */
export const MAX_PHOTOS = 5;

export type Sex = 1 | 2;
export type Relation = 'child' | 'spouse' | 'parent' | 'sibling';
export type TreeRole = 'owner' | 'editor';

/** One person. Children (`c`) and spouses (`sp`) reference other ids in the same tree. */
export interface Person {
  n: string;
  s: Sex;
  c: string[];
  sp: string[];
  b?: string;
  d?: string;
  origin?: string;
  /** Free-form biography / family story. */
  note?: string;
  /** Up to 5 photos, each a compressed image data URL. */
  photos?: string[];
}

export type PeopleMap = Record<string, Person>;

/** The full tree document returned by the API. */
export interface Tree {
  id: number;
  title: string;
  root: string;
  p: PeopleMap;
  createdAt?: string;
  updatedAt?: string;
  demo?: boolean;
}

export interface TreeSummary {
  id: number;
  title: string;
  people: number;
  role: TreeRole;
  ownerEmail?: string;
  pendingCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: number;
  email: string;
  createdAt?: string;
}

export interface Collaborator {
  userId: number;
  email: string;
  role: string;
  createdAt: string;
}

export interface Invite {
  id: number;
  token: string;
  role: string;
  createdAt: string;
}

export interface VersionSummary {
  id: number;
  title: string;
  note: string | null;
  people: number;
  createdAt: string;
  createdByEmail: string | null;
}

export interface PendingProposal {
  id: number;
  note: string | null;
  people: number;
  proposerEmail: string;
  createdAt: string;
  updatedAt: string;
}
