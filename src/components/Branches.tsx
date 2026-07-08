import { descCount, lifeSpan, relLabel } from '../lib/treeUtils';
import type { PeopleMap } from '../lib/types';
import { Highlighted, SexDot } from './shared';

export interface RenderCtx {
  p: PeopleMap;
  query: string;
  matchIds: Set<string>;
  ancestors: Set<string>;
  openSet: Set<string>;
  toggle: (id: string) => void;
  openDetail: (id: string) => void;
}

function SubItem({
  id,
  gen,
  seen,
  ctx,
}: {
  id: string;
  gen: number;
  seen: Set<string>;
  ctx: RenderCtx;
}) {
  const { p, query, matchIds, ancestors, openSet, toggle, openDetail } = ctx;
  const person = p[id];
  if (!person) return null;

  const kids = (person.c || []).filter((c) => p[c] && !seen.has(c));
  const count = descCount(p, id, new Set(seen));
  const open = (openSet.has(id) || ancestors.has(id)) && kids.length > 0;
  const ls = lifeSpan(p, id);
  const nextSeen = new Set(seen);
  nextSeen.add(id);

  const activate = () => {
    if (!kids.length) openDetail(id);
    else toggle(id);
  };
  const onHeadClick = (e: React.MouseEvent) => {
    const t = e.target as HTMLElement;
    if (t.closest('.edit-actions')) return;
    if (t.closest('.sub-name') || t.closest('.sexdot')) {
      openDetail(id);
      return;
    }
    activate();
  };

  return (
    <div className={'sub-item' + (matchIds.has(id) ? ' hit' : '') + (open ? ' open' : '')}>
      <div
        className="sub-head"
        tabIndex={0}
        role="button"
        onClick={onHeadClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            activate();
          }
        }}
      >
        <span className="branch-chevron" style={{ opacity: kids.length ? undefined : 0 }}>
          {kids.length ? '›' : ''}
        </span>
        <SexDot sex={person.s} deceased={!!person.d} />
        <span className="sub-name">
          <Highlighted name={person.n} query={query} />
        </span>
        {ls && <span className="sub-yr">· {ls}</span>}
        <span className="sub-meta">
          {'· ' + relLabel(gen, person.s === 2) + (kids.length ? ' · потомков: ' + count : '')}
        </span>
      </div>
      <div className="sub-children">
        {kids.map((cid) => (
          <SubItem key={cid} id={cid} gen={gen + 1} seen={nextSeen} ctx={ctx} />
        ))}
      </div>
    </div>
  );
}

function BranchCard({ id, idx, gen, ctx }: { id: string; idx: number; gen: number; ctx: RenderCtx }) {
  const { p, query, matchIds, ancestors, openSet, toggle, openDetail } = ctx;
  const person = p[id];
  const kids = (person.c || []).filter((c) => p[c]);
  const open =
    (openSet.has(id) || ancestors.has(id) || matchIds.has(id)) && kids.length > 0;
  const count = descCount(p, id, new Set());
  const ls = lifeSpan(p, id);
  const seen = new Set([id]);

  const activate = () => {
    if (!kids.length) openDetail(id);
    else toggle(id);
  };
  const onHeadClick = (e: React.MouseEvent) => {
    const t = e.target as HTMLElement;
    if (t.closest('.edit-actions')) return;
    if (t.closest('.branch-name') || t.closest('.sexdot')) {
      openDetail(id);
      return;
    }
    activate();
  };

  return (
    <div className={'branch-card' + (matchIds.has(id) ? ' hit' : '') + (open ? ' open' : '')}>
      <div
        className="branch-head"
        tabIndex={0}
        role="button"
        onClick={onHeadClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            activate();
          }
        }}
      >
        <div className="branch-num">{idx + 1}</div>
        <div className="branch-info">
          <div className="branch-name">
            <SexDot sex={person.s} deceased={!!person.d} />
            <Highlighted name={person.n} query={query} />
            {ls && <span className="yr">· {ls}</span>}
          </div>
          <div className="branch-meta">
            {relLabel(gen, person.s === 2) + (count ? ' · потомков: ' + count : '')}
          </div>
        </div>
        <div className="branch-chevron">›</div>
      </div>
      <div className="branch-body">
        <div className="sub-list">
          {kids.map((cid) => (
            <SubItem key={cid} id={cid} gen={gen + 1} seen={seen} ctx={ctx} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function BranchList({
  branchIds,
  branchGen,
  ctx,
}: {
  branchIds: string[];
  branchGen: number;
  ctx: RenderCtx;
}) {
  return (
    <div className="branch-list">
      {branchIds.map((id, idx) => (
        <BranchCard key={id} id={id} idx={idx} gen={branchGen} ctx={ctx} />
      ))}
    </div>
  );
}
