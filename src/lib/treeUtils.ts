import type { PeopleMap } from './types';

/** Normalize for search: fold Uzbek Cyrillic variants so ў≈у, қ≈к, etc. */
export function norm(s: string): string {
  return String(s || '')
    .toLowerCase()
    .replace(/ў/g, 'у')
    .replace(/қ/g, 'к')
    .replace(/ғ/g, 'г')
    .replace(/ҳ/g, 'х')
    .replace(/ё/g, 'е');
}

export function yearOf(str?: string): string | null {
  if (!str) return null;
  const m = String(str).match(/(\d{4})/);
  return m ? m[1] : null;
}

export function lifeSpan(p: PeopleMap, id: string): string {
  const person = p[id];
  if (!person) return '';
  const b = yearOf(person.b);
  const d = yearOf(person.d);
  if (b && d) return b + '–' + d;
  if (b) return b;
  if (d) return '† ' + d;
  return '';
}

export function lifeFull(p: PeopleMap, id: string): string {
  const person = p[id];
  if (!person) return '';
  const parts: string[] = [];
  if (person.b) parts.push('★ ' + person.b);
  if (person.d) parts.push('† ' + person.d);
  return parts.join('   ');
}

export function descCount(p: PeopleMap, id: string, seen = new Set<string>()): number {
  if (seen.has(id)) return 0;
  seen.add(id);
  let total = 0;
  for (const c of p[id]?.c || []) {
    if (p[c]) total += 1 + descCount(p, c, seen);
  }
  return total;
}

export function relLabel(gen: number, isFemale: boolean): string {
  if (gen === 0) return isFemale ? 'РОДОНАЧАЛЬНИЦА' : 'РОДОНАЧАЛЬНИК';
  const m = ['', 'сын', 'внук', 'правнук'];
  const f = ['', 'дочь', 'внучка', 'правнучка'];
  if (gen <= 3) return isFemale ? f[gen] : m[gen];
  const n = gen - 2;
  return isFemale ? 'пра(' + n + ')-внучка' : 'пра(' + n + ')-внук';
}

export function parentsOf(p: PeopleMap, id: string): string[] {
  const res: string[] = [];
  for (const pid of Object.keys(p)) {
    if ((p[pid].c || []).indexOf(id) !== -1) res.push(pid);
  }
  return res;
}

/** id -> spouse ids, resolved in both directions. Build once per tree. */
export type SpouseIndex = Map<string, string[]>;

/**
 * Index every spouse link from both sides in a single pass.
 *
 * Older trees recorded `sp` on only one partner, so a reverse lookup is what
 * makes those wives visible at all. Doing that lookup per person would be
 * O(n²) across a render, hence the shared index.
 */
export function buildSpouseIndex(p: PeopleMap): SpouseIndex {
  const idx: SpouseIndex = new Map();
  const link = (a: string, b: string) => {
    if (a === b || !p[a] || !p[b]) return;
    const list = idx.get(a);
    if (!list) idx.set(a, [b]);
    else if (list.indexOf(b) === -1) list.push(b);
  };
  for (const id of Object.keys(p)) {
    for (const sid of p[id].sp || []) {
      link(id, sid);
      link(sid, id);
    }
  }
  return idx;
}

/**
 * Spouses of `id`, resolved in both directions. Pass `idx` on hot paths (the
 * tree render); without it this falls back to a one-off scan.
 */
export function spousesOf(p: PeopleMap, id: string, idx?: SpouseIndex): string[] {
  if (idx) return idx.get(id) || [];
  return (buildSpouseIndex(p).get(id) || []).slice();
}

/** 'жена' / 'муж' for a spouse, chosen from the spouse's own sex. */
export function spouseLabel(p: PeopleMap, spouseId: string): string {
  return p[spouseId]?.s === 2 ? 'жена' : 'муж';
}

/**
 * Both parents of `id`. Anyone listing `id` as a child counts directly; when
 * that yields a single parent we also surface their spouse as the co-parent, so
 * a mother shows up even in trees where children were only ever attached to the
 * father.
 */
export function parentsWithCoParent(p: PeopleMap, id: string, idx?: SpouseIndex): string[] {
  const direct = parentsOf(p, id);
  if (direct.length !== 1) return direct;
  const spouses = spousesOf(p, direct[0], idx);
  return spouses.length === 1 ? [direct[0], spouses[0]] : direct;
}

/** The direct male-line-style chain: follow while there is exactly one living child. */
export function buildChain(p: PeopleMap, root: string): string[] {
  const chain = [root];
  let cur = root;
  let guard = 0;
  while (guard++ < 50) {
    const kids = (p[cur]?.c || []).filter((k) => p[k]);
    if (kids.length === 1) {
      cur = kids[0];
      chain.push(cur);
    } else break;
  }
  return chain;
}

export interface MatchState {
  matchIds: Set<string>;
  ancestorsOfMatch: Set<string>;
}

export function recomputeMatches(p: PeopleMap, query: string): MatchState {
  const matchIds = new Set<string>();
  const ancestorsOfMatch = new Set<string>();
  if (!query) return { matchIds, ancestorsOfMatch };
  const q = norm(query);
  for (const id of Object.keys(p)) {
    if (norm(p[id].n).indexOf(q) !== -1) matchIds.add(id);
  }
  matchIds.forEach((id) => {
    let frontier = [id];
    let guard = 0;
    while (frontier.length && guard++ < 500) {
      const next: string[] = [];
      frontier.forEach((cur) => {
        parentsOf(p, cur).forEach((par) => {
          if (!ancestorsOfMatch.has(par)) {
            ancestorsOfMatch.add(par);
            next.push(par);
          }
        });
      });
      frontier = next;
    }
  });
  return { matchIds, ancestorsOfMatch };
}

/** Highlight segments for rendering matched substrings inside a name. */
export interface HiPart {
  text: string;
  mark: boolean;
}
export function highlightParts(name: string, query: string): HiPart[] {
  if (!query) return [{ text: name, mark: false }];
  const q = norm(query);
  const nn = norm(name);
  const idx = nn.indexOf(q);
  if (idx === -1) return [{ text: name, mark: false }];
  return [
    { text: name.slice(0, idx), mark: false },
    { text: name.slice(idx, idx + query.length), mark: true },
    { text: name.slice(idx + query.length), mark: false },
  ].filter((p) => p.text.length > 0);
}

/** Minimum generation distance from root along descent (Infinity if unreachable). */
export function genOf(p: PeopleMap, root: string, id: string): number {
  let found = Infinity;
  const walk = (cur: string, g: number, seen: Set<string>) => {
    if (seen.has(cur)) return;
    seen.add(cur);
    if (cur === id) {
      found = Math.min(found, g);
      return;
    }
    for (const c of p[cur]?.c || []) {
      if (p[c]) walk(c, g + 1, seen);
    }
  };
  walk(root, 0, new Set());
  return found;
}

export function genCount(p: PeopleMap, root: string): number {
  let mx = 0;
  const d = (id: string, g: number, s: Set<string>) => {
    if (s.has(id)) return;
    s.add(id);
    mx = Math.max(mx, g);
    for (const c of p[id]?.c || []) {
      if (p[c]) d(c, g + 1, s);
    }
  };
  d(root, 1, new Set());
  return mx;
}

export function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}

export function everyoneWithKids(p: PeopleMap): string[] {
  const ids: string[] = [];
  for (const id of Object.keys(p)) {
    if ((p[id].c || []).some((c) => p[c])) ids.push(id);
  }
  return ids;
}

export interface TreeStats {
  people: number;
  generations: number;
  male: number;
  female: number;
  withDates: number;
}

export function computeStats(p: PeopleMap, root: string): TreeStats {
  const ids = Object.keys(p);
  let male = 0;
  let female = 0;
  let withDates = 0;
  for (const id of ids) {
    if (p[id].s === 1) male++;
    else female++;
    if (p[id].b || p[id].d) withDates++;
  }
  return { people: ids.length, generations: genCount(p, root), male, female, withDates };
}
