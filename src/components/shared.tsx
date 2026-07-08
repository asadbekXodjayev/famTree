import { Fragment } from 'react';
import { highlightParts } from '../lib/treeUtils';
import type { Sex } from '../lib/types';

export interface EditOps {
  addChild: (id: string) => void;
  addSpouse: (id: string) => void;
  rename: (id: string) => void;
  dates: (id: string) => void;
  remove: (id: string) => void;
}

export function SexDot({ sex, deceased, size }: { sex: Sex; deceased?: boolean; size?: number }) {
  const background = deceased ? 'var(--ink-faint)' : sex === 1 ? 'var(--male)' : 'var(--female)';
  const dim = size ? { width: size, height: size } : undefined;
  return <span className="sexdot" style={{ background, ...dim }} aria-hidden="true" />;
}

export function Highlighted({ name, query }: { name: string; query: string }) {
  const parts = highlightParts(name, query);
  return (
    <>
      {parts.map((p, i) => (
        <Fragment key={i}>{p.mark ? <mark>{p.text}</mark> : p.text}</Fragment>
      ))}
    </>
  );
}

function EBtn({
  children,
  title,
  danger,
  onClick,
}: {
  children: string;
  title: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={'ebtn' + (danger ? ' danger' : '')}
      title={title}
      aria-label={title}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      {children}
    </button>
  );
}

/** The inline +♥✎📅✕ controls. Rendered only when `ops` is present; visibility is
 * governed by the `.edit-on` class on an ancestor (toggled by the edit button). */
export function EditActions({ id, ops, noDelete }: { id: string; ops?: EditOps; noDelete?: boolean }) {
  if (!ops) return null;
  return (
    <span className="edit-actions">
      <EBtn title="Добавить ребёнка" onClick={() => ops.addChild(id)}>
        +
      </EBtn>
      <EBtn title="Добавить супруга/супругу" onClick={() => ops.addSpouse(id)}>
        ♥
      </EBtn>
      <EBtn title="Изменить имя" onClick={() => ops.rename(id)}>
        ✎
      </EBtn>
      <EBtn title="Даты жизни" onClick={() => ops.dates(id)}>
        📅
      </EBtn>
      {!noDelete && (
        <EBtn danger title="Удалить" onClick={() => ops.remove(id)}>
          ✕
        </EBtn>
      )}
    </span>
  );
}
