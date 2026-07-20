import { Fragment } from 'react';
import { highlightParts } from '../lib/treeUtils';
import type { Sex } from '../lib/types';

/**
 * Sex/deceased indicator. The dot is the only channel carrying this in the
 * branch list, so it also emits a visually-hidden text equivalent — colour
 * alone would leave screen-reader users without the two facts a shajara is
 * actually about (WCAG 1.4.1).
 */
export function SexDot({ sex, deceased, size }: { sex: Sex; deceased?: boolean; size?: number }) {
  const background = deceased ? 'var(--ink-faint)' : sex === 1 ? 'var(--male)' : 'var(--female)';
  const dim = size ? { width: size, height: size } : undefined;
  const label = (sex === 1 ? 'мужчина' : 'женщина') + (deceased ? ', ушёл(ла) из жизни' : '');
  return (
    <>
      <span className="sexdot" style={{ background, ...dim }} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </>
  );
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
