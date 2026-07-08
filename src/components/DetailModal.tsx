import { useEffect, useRef } from 'react';
import { genOf, lifeFull, lifeSpan, parentsOf, relLabel } from '../lib/treeUtils';
import type { PeopleMap } from '../lib/types';
import { SexDot } from './shared';

function Chip({ p, id, onGoto }: { p: PeopleMap; id: string; onGoto: (id: string) => void }) {
  const person = p[id];
  if (!person) return null;
  const ls = lifeSpan(p, id);
  return (
    <button type="button" className="rel-chip" onClick={() => onGoto(id)}>
      <SexDot sex={person.s} deceased={!!person.d} />
      {person.n}
      {ls && <span className="yr"> {ls}</span>}
    </button>
  );
}

function RelBlock({
  label,
  p,
  ids,
  onGoto,
}: {
  label: string;
  p: PeopleMap;
  ids: string[];
  onGoto: (id: string) => void;
}) {
  const list = ids.filter((id) => p[id]);
  return (
    <div className="rel-block">
      <div className="rel-label">{label}</div>
      {list.length ? (
        <div className="rel-chips">
          {list.map((id) => (
            <Chip key={id} p={p} id={id} onGoto={onGoto} />
          ))}
        </div>
      ) : (
        <div className="rel-empty">нет данных</div>
      )}
    </div>
  );
}

export function DetailModal({
  p,
  root,
  id,
  onClose,
  onGoto,
}: {
  p: PeopleMap;
  root: string;
  id: string;
  onClose: () => void;
  onGoto: (id: string) => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const person = p[id];
  if (!person) return null;

  const parents = parentsOf(p, id);
  const spouses = (person.sp || []).slice();
  const kids = (person.c || []).slice();
  const lf = lifeFull(p, id);
  const g = genOf(p, root, id);
  const genTxt = g !== Infinity ? ' · ' + relLabel(g, person.s === 2) : '';

  return (
    <div
      className="overlay show"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modalName"
      onClick={(e) => {
        if ((e.target as HTMLElement).classList.contains('overlay')) onClose();
      }}
    >
      <div className="modal">
        <div className="modal-top">
          <button ref={closeRef} className="modal-close" onClick={onClose} aria-label="Закрыть">
            ✕
          </button>
          <div className="modal-badge">
            {(person.s === 1 ? '♂ мужчина' : '♀ женщина') + (person.d ? ' · память' : '')}
          </div>
          <h3 className="modal-name" id="modalName">
            <SexDot sex={person.s} deceased={!!person.d} size={12} />
            {person.n}
          </h3>
          <div className="modal-life">{(lf || 'Даты жизни не указаны') + genTxt}</div>
        </div>
        <div className="modal-body">
          <RelBlock label="Родители" p={p} ids={parents} onGoto={onGoto} />
          <RelBlock label={person.s === 1 ? 'Супруга' : 'Супруг'} p={p} ids={spouses} onGoto={onGoto} />
          <RelBlock label={'Дети (' + kids.filter((k) => p[k]).length + ')'} p={p} ids={kids} onGoto={onGoto} />
        </div>
      </div>
    </div>
  );
}
