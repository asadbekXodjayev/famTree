import { spousesOf } from './treeUtils';
import { MAX_PHOTOS } from './types';
import type { PeopleMap, Person, Relation, Sex } from './types';

export interface WorkingTree {
  root: string;
  p: PeopleMap;
}

/** Shallow-copy the map; only persons we actually touch get cloned (photos are shared, never mutated in place). */
function shallowMap(p: PeopleMap): PeopleMap {
  return { ...p };
}
/** Replace p[id] with a fresh copy (with fresh c/sp arrays) and return it for mutation. */
function mut(p: PeopleMap, id: string): Person {
  const copy: Person = { ...p[id], c: [...p[id].c], sp: [...p[id].sp] };
  p[id] = copy;
  return copy;
}

/** Mirror of the backend nextId: safe-integer keys only, then a collision sweep. */
function nextId(p: PeopleMap): string {
  let mx = 0;
  for (const k of Object.keys(p)) {
    const n = Number(k);
    if (Number.isSafeInteger(n) && n > mx) mx = n;
  }
  let candidate = mx + 1;
  while (Object.prototype.hasOwnProperty.call(p, String(candidate))) candidate++;
  return String(candidate);
}

function parentsOf(p: PeopleMap, id: string): string[] {
  return Object.keys(p).filter((pid) => p[pid].c.includes(id));
}

/** Client-side mirror of the backend addRelative — used for editor proposal drafts. */
export function addRelative(
  tree: WorkingTree,
  anchorId: string,
  relation: Relation,
  name: string,
  sex: Sex,
): WorkingTree {
  const p = shallowMap(tree.p);
  if (!p[anchorId]) throw new Error('Человек не найден');
  const nm = name.trim();
  if (!nm) throw new Error('Имя не может быть пустым');
  let root = tree.root;
  const id = nextId(p);
  const np: Person = { n: nm, s: sex, c: [], sp: [] };
  p[id] = np;

  switch (relation) {
    case 'child': {
      const anchor = mut(p, anchorId);
      anchor.c.push(id);
      // Mirror of the backend: link an unambiguous co-parent so the mother is a
      // real parent edge, not merely the father's spouse. Both directions, since
      // legacy trees record `sp` on one partner only.
      const coParents = spousesOf(p, anchorId).filter((sid) => sid !== id);
      if (coParents.length === 1) {
        const co = mut(p, coParents[0]);
        if (!co.c.includes(id)) co.c.push(id);
      }
      break;
    }
    case 'spouse':
      mut(p, anchorId).sp.push(id);
      np.sp.push(anchorId);
      break;
    case 'parent': {
      np.c.push(anchorId);
      const existing = parentsOf(p, anchorId).filter((x) => x !== id);
      if (anchorId === root) root = id;
      if (existing.length) {
        const ep = mut(p, existing[0]);
        if (!ep.sp.includes(id)) {
          ep.sp.push(id);
          np.sp.push(existing[0]);
        }
      }
      break;
    }
    case 'sibling': {
      const parents = parentsOf(p, anchorId).filter((x) => x !== id);
      if (!parents.length) throw new Error('Сначала добавьте родителя');
      for (const par of parents) {
        const pp = mut(p, par);
        if (!pp.c.includes(id)) pp.c.push(id);
      }
      break;
    }
  }
  return { root, p };
}

export function renamePerson(tree: WorkingTree, id: string, name: string): WorkingTree {
  const nm = name.trim();
  if (!nm) throw new Error('Имя не может быть пустым');
  const p = shallowMap(tree.p);
  mut(p, id).n = nm;
  return { root: tree.root, p };
}

export function setSex(tree: WorkingTree, id: string, sex: Sex): WorkingTree {
  const p = shallowMap(tree.p);
  mut(p, id).s = sex;
  return { root: tree.root, p };
}

export function setField(
  tree: WorkingTree,
  id: string,
  field: 'b' | 'd' | 'origin' | 'note',
  value: string,
): WorkingTree {
  const p = shallowMap(tree.p);
  const per = mut(p, id);
  const v = value.trim();
  if (v) per[field] = v;
  else delete per[field];
  return { root: tree.root, p };
}

/**
 * Mirror of the backend cascade: only take a child down when every one of its
 * parents is also being deleted, so removing a mother does not erase children
 * whose father survives. Fixpoint, because a co-parent may be removed later.
 */
function cascadeSet(p: PeopleMap, id: string): Set<string> {
  const parents = new Map<string, string[]>();
  for (const pid of Object.keys(p)) {
    for (const c of p[pid].c) {
      if (!parents.has(c)) parents.set(c, []);
      parents.get(c)!.push(pid);
    }
  }
  const toDelete = new Set<string>([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const cur of Array.from(toDelete)) {
      for (const c of p[cur]?.c || []) {
        if (!p[c] || toDelete.has(c)) continue;
        if ((parents.get(c) || []).some((par) => !toDelete.has(par))) continue;
        toDelete.add(c);
        grew = true;
      }
    }
  }
  return toDelete;
}

/** Everyone the UI shows: reachable from root by descent, plus their spouses. */
function reachableSet(p: PeopleMap, root: string): Set<string> {
  const seen = new Set<string>();
  const stack = [root];
  while (stack.length) {
    const cur = stack.pop()!;
    if (seen.has(cur) || !p[cur]) continue;
    seen.add(cur);
    for (const c of p[cur].c) if (!seen.has(c)) stack.push(c);
    for (const s of p[cur].sp) if (!seen.has(s)) stack.push(s);
  }
  return seen;
}

/**
 * How many people `deletePerson(id)` would actually remove — cascade plus
 * anyone it strands. The confirmation dialog must not overstate this.
 */
export function countDeletion(tree: WorkingTree, id: string): number {
  if (!tree.p[id]) return 0;
  const probe = deletePerson(tree, id);
  return Object.keys(tree.p).length - Object.keys(probe.p).length;
}

export function deletePerson(tree: WorkingTree, id: string): WorkingTree {
  if (id === tree.root) throw new Error('Родоначальника нельзя удалить');
  const p = shallowMap(tree.p);
  const toDelete = cascadeSet(p, id);
  // Cyclic data (reachable via JSON import) could otherwise drag the root into
  // the cascade, producing a document the server rejects on every save.
  if (toDelete.has(tree.root)) throw new Error('Это действие удалит родоначальника');
  for (const pid of Object.keys(p)) {
    if (toDelete.has(pid)) continue;
    const per = p[pid];
    const nc = per.c.filter((c) => !toDelete.has(c));
    const ns = per.sp.filter((s) => !toDelete.has(s));
    if (nc.length !== per.c.length || ns.length !== per.sp.length) {
      p[pid] = { ...per, c: nc, sp: ns };
    }
  }
  const reachableBefore = reachableSet(tree.p, tree.root);
  for (const d of toDelete) delete p[d];

  // Sweep anyone this delete stranded — see the backend comment. A wife hangs
  // off the tree only via her husband, so deleting him can hide her and any
  // children who survived because she was their other parent.
  const reachableAfter = reachableSet(p, tree.root);
  let stranded = false;
  for (const pid of Object.keys(p)) {
    if (reachableBefore.has(pid) && !reachableAfter.has(pid)) {
      delete p[pid];
      stranded = true;
    }
  }
  if (stranded) {
    for (const pid of Object.keys(p)) {
      const per = p[pid];
      const nc = per.c.filter((c) => p[c]);
      const ns = per.sp.filter((s) => p[s]);
      if (nc.length !== per.c.length || ns.length !== per.sp.length) {
        p[pid] = { ...per, c: nc, sp: ns };
      }
    }
  }
  return { root: tree.root, p };
}

export function addPhoto(tree: WorkingTree, id: string, dataUrl: string): WorkingTree {
  const p = shallowMap(tree.p);
  const per = mut(p, id);
  per.photos = per.photos ? [...per.photos] : [];
  if (per.photos.length >= MAX_PHOTOS) throw new Error(`Максимум ${MAX_PHOTOS} фотографий`);
  per.photos.push(dataUrl);
  return { root: tree.root, p };
}

export function removePhoto(tree: WorkingTree, id: string, index: number): WorkingTree {
  const p = shallowMap(tree.p);
  const per = mut(p, id);
  if (per.photos) {
    per.photos = per.photos.filter((_, i) => i !== index);
    if (!per.photos.length) delete per.photos;
  }
  return { root: tree.root, p };
}

export interface TreeDiff {
  added: string[];
  removed: string[];
  changed: string[];
}

/** Summarize what a proposal changed vs the current tree (for the owner's review). */
export function diffTrees(base: WorkingTree, next: WorkingTree): TreeDiff {
  const bk = new Set(Object.keys(base.p));
  const nk = new Set(Object.keys(next.p));
  const added = [...nk].filter((k) => !bk.has(k));
  const removed = [...bk].filter((k) => !nk.has(k));
  const changed = [...nk].filter(
    (k) => bk.has(k) && JSON.stringify(base.p[k]) !== JSON.stringify(next.p[k]),
  );
  return { added, removed, changed };
}
