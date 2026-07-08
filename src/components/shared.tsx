import { Fragment } from 'react';
import { highlightParts } from '../lib/treeUtils';
import type { Sex } from '../lib/types';

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
