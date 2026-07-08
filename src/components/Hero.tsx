import { useEffect, useMemo, useRef, useState } from 'react';
import { lifeSpan, type TreeStats } from '../lib/treeUtils';
import type { PeopleMap } from '../lib/types';
import { Highlighted, SexDot } from './shared';

function SearchBox({
  p,
  query,
  matchQuery,
  setQuery,
  matchIds,
  openDetail,
}: {
  p: PeopleMap;
  query: string;
  matchQuery: string;
  setQuery: (q: string) => void;
  matchIds: Set<string>;
  openDetail: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);

  const list = useMemo(
    () => [...matchIds].slice(0, 40).sort((a, b) => p[a].n.localeCompare(p[b].n)),
    [matchIds, p],
  );

  useEffect(() => {
    setActive(-1);
    setOpen(!!matchQuery);
  }, [matchQuery]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('click', h);
    return () => document.removeEventListener('click', h);
  }, []);

  const pick = (id: string) => {
    setOpen(false);
    openDetail(id);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, list.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      if (list[active]) pick(list[active]);
    } else if (e.key === 'Escape') {
      setQuery('');
    }
  };

  return (
    <div className="search-wrap" ref={wrapRef}>
      <span className="search-ic" aria-hidden="true">
        ⌕
      </span>
      <input
        type="text"
        className="search-in"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => matchQuery && setOpen(true)}
        placeholder="Поиск по имени…"
        aria-label="Поиск по имени"
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls="results"
      />
      <button
        type="button"
        className={'search-clear' + (query ? ' show' : '')}
        onClick={() => setQuery('')}
        aria-label="Очистить"
      >
        ✕
      </button>
      <div className={'results' + (open ? ' show' : '')} id="results" role="listbox">
        {matchQuery &&
          (list.length ? (
            list.map((id, i) => {
              const ls = lifeSpan(p, id);
              return (
                <div
                  key={id}
                  className={'res-item' + (i === active ? ' active' : '')}
                  role="option"
                  aria-selected={i === active}
                  onClick={() => pick(id)}
                  onMouseEnter={() => setActive(i)}
                >
                  <SexDot sex={p[id].s} deceased={!!p[id].d} size={8} />
                  <span className="rn">
                    <Highlighted name={p[id].n} query={matchQuery} />
                  </span>
                  <span className="rmeta">{ls || '—'}</span>
                </div>
              );
            })
          ) : (
            <div className="res-empty">Никого не найдено</div>
          ))}
      </div>
    </div>
  );
}

export function Hero({
  p,
  root,
  stats,
  query,
  matchQuery,
  setQuery,
  matchIds,
  openDetail,
}: {
  p: PeopleMap;
  root: string;
  stats: TreeStats;
  query: string;
  matchQuery: string;
  setQuery: (q: string) => void;
  matchIds: Set<string>;
  openDetail: (id: string) => void;
}) {
  const rootName = p[root]?.n ?? '';
  const origin = p[root]?.origin;
  const cells: [number, string][] = [
    [stats.people, 'человек'],
    [stats.generations, 'поколений'],
    [stats.male, 'мужчин'],
    [stats.female, 'женщин'],
    [stats.withDates, 'с датами'],
  ];

  return (
    <header className="hero">
      <div className="eyebrow">Родословная · Шажара · Насаб</div>
      <h1>{'Род ' + rootName}</h1>
      {origin && (
        <div className="origin">
          <span aria-hidden="true">⌖</span> <span>{'Родовое место · ' + origin}</span>
        </div>
      )}
      <p className="subtitle">
        Пять поколений одной семьи — от родоначальника до пра‑правнуков.
        <br />
        Найдите человека по имени или раскройте любую ветвь древа.
      </p>

      <div className="stats">
        {cells.map(([n, l]) => (
          <div className="stat" key={l}>
            <div className="stat-num">{n}</div>
            <div className="stat-lbl">{l}</div>
          </div>
        ))}
      </div>

      <SearchBox
        p={p}
        query={query}
        matchQuery={matchQuery}
        setQuery={setQuery}
        matchIds={matchIds}
        openDetail={openDetail}
      />
    </header>
  );
}
