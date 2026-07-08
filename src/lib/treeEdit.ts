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

function nextId(p: PeopleMap): string {
  let mx = 0;
  for (const k of Object.keys(p)) {
    const n = parseInt(k, 10);
    if (!Number.isNaN(n) && n > mx) mx = n;
  }
  return String(mx + 1);
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
    case 'child':
      mut(p, anchorId).c.push(id);
      break;
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
  field: 'b' | 'd' | 'origin',
  value: string,
): WorkingTree {
  const p = shallowMap(tree.p);
  const per = mut(p, id);
  const v = value.trim();
  if (v) per[field] = v;
  else delete per[field];
  return { root: tree.root, p };
}

export function deletePerson(tree: WorkingTree, id: string): WorkingTree {
  if (id === tree.root) throw new Error('Родоначальника нельзя удалить');
  const p = shallowMap(tree.p);
  const toDelete = new Set<string>([id]);
  const stack = [id];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const c of p[cur]?.c || []) {
      if (p[c] && !toDelete.has(c)) {
        toDelete.add(c);
        stack.push(c);
      }
    }
  }
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
  for (const d of toDelete) delete p[d];
  return { root: tree.root, p };
}

export function addPhoto(tree: WorkingTree, id: string, dataUrl: string): WorkingTree {
  const p = shallowMap(tree.p);
  const per = mut(p, id);
  per.photos = per.photos ? [...per.photos] : [];
  if (per.photos.length >= 5) throw new Error('Максимум 5 фотографий');
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
