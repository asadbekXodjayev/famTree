export type Sex = 1 | 2;

/** One person. Children (`c`) and spouses (`sp`) reference other ids in the same tree. */
export interface Person {
  n: string;
  s: Sex;
  c: string[];
  sp: string[];
  b?: string;
  d?: string;
  origin?: string;
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
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: number;
  email: string;
  createdAt?: string;
}
