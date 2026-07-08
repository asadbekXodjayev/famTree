import { Fragment, useCallback, useMemo, useState } from 'react';
import type { UseTree } from '../hooks/useTree';
import { exportTreePng } from '../lib/png';
import {
  buildChain,
  computeStats,
  descCount,
  everyoneWithKids,
  lifeSpan,
  plural,
  recomputeMatches,
  relLabel,
} from '../lib/treeUtils';
import type { Sex } from '../lib/types';
import { BranchList, type RenderCtx } from './Branches';
import { DetailModal } from './DetailModal';
import { Hero } from './Hero';
import { EditActions, type EditOps } from './shared';
import { Toolbar, type ImportedTree } from './Toolbar';

export function TreeView({ t }: { t: UseTree }) {
  const tree = t.tree!;
  const p = tree.p;
  const root = tree.root;

  const [openSet, setOpenSet] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  // Trim for matching/highlighting (reference behaviour) while the input keeps the raw value.
  const q = query.trim();
  const { matchIds, ancestorsOfMatch } = useMemo(() => recomputeMatches(p, q), [p, q]);
  const stats = useMemo(() => computeStats(p, root), [p, root]);
  const chain = useMemo(() => buildChain(p, root), [p, root]);
  const lastChainId = chain[chain.length - 1];
  const branchGen = chain.length - 1;
  const branchIds = (p[lastChainId]?.c || []).filter((id) => p[id]);

  const toggle = useCallback((id: string) => {
    setOpenSet((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }, []);
  const openDetail = useCallback((id: string) => setSelected(id), []);
  const expandAll = () => setOpenSet(new Set(everyoneWithKids(p)));
  const collapseAll = () => setOpenSet(new Set());

  const ops: EditOps | undefined = t.editable
    ? {
        addChild: (id) => {
          const name = window.prompt('Имя нового ребёнка:');
          if (!name || !name.trim()) return;
          const sexAns = window.prompt('Пол — мужской: 1, женский: 2', '1');
          const sex: Sex = sexAns && sexAns.trim() === '2' ? 2 : 1;
          void t.addPerson(id, name.trim(), sex, false);
          setOpenSet((prev) => new Set(prev).add(id));
        },
        addSpouse: (id) => {
          const name = window.prompt('Имя супруга/супруги:');
          if (!name || !name.trim()) return;
          const sex: Sex = p[id].s === 1 ? 2 : 1;
          void t.addPerson(id, name.trim(), sex, true);
        },
        rename: (id) => {
          const name = window.prompt('Имя:', p[id].n);
          if (name && name.trim()) void t.renamePerson(id, name.trim());
        },
        dates: (id) => {
          const b = window.prompt(
            'Год рождения (напр. 12.05.1970 или 1970). Пусто — удалить:',
            p[id].b || '',
          );
          if (b === null) return;
          const d = window.prompt('Дата смерти (пусто — при жизни):', p[id].d || '');
          if (d === null) return;
          void t.editDates(id, b.trim(), d.trim());
        },
        remove: (id) => {
          if (id === root) {
            alert('Родоначальника нельзя удалить.');
            return;
          }
          const cnt = descCount(p, id, new Set());
          if (
            !window.confirm(
              '«' + p[id].n + '» и его потомков (' + cnt + ') удалить? Это действие необратимо.',
            )
          )
            return;
          void t.deletePerson(id);
          if (selected === id) setSelected(null);
        },
      }
    : undefined;

  const ctx: RenderCtx = {
    p,
    query: q,
    matchIds,
    ancestors: ancestorsOfMatch,
    openSet,
    toggle,
    openDetail,
    ops,
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ root, p, title: tree.title }, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'shajara.json';
    a.click();
    URL.revokeObjectURL(url);
    t.flash('⭳ Экспортировано');
  };

  const importData = (data: ImportedTree) => {
    void t.replaceTree({ root: data.root, p: data.p });
    setOpenSet(new Set());
    setSelected(null);
  };

  // spouse pills belong to the deepest chain member that has any
  let pillOwner: string | null = null;
  for (let i = chain.length - 1; i >= 0; i--) {
    if ((p[chain[i]].sp || []).length) {
      pillOwner = chain[i];
      break;
    }
  }

  const branchTitle =
    branchIds.length + ' ' + plural(branchIds.length, 'ветвь', 'ветви', 'ветвей') + ' рода';
  const branchSub = branchIds.length
    ? 'Дети ' + p[lastChainId].n + ' и их потомки — внуки, правнуки и последующие поколения'
    : 'У ' + p[lastChainId].n + ' пока нет добавленных детей';

  return (
    <div className={editMode ? 'edit-on' : undefined}>
      <Toolbar
        editable={t.editable}
        editMode={editMode}
        setEditMode={setEditMode}
        onExpand={expandAll}
        onCollapse={collapseAll}
        onPng={() => exportTreePng(p, root)}
        onExportJson={exportJson}
        onImportData={importData}
        onRefresh={() => void t.reload()}
        saveMsg={t.saveMsg}
      />

      <div className="wrap">
        <Hero
          p={p}
          root={root}
          stats={stats}
          query={query}
          matchQuery={q}
          setQuery={setQuery}
          matchIds={matchIds}
          openDetail={openDetail}
        />

        <p className="chain-title">Прямая линия рода</p>
        <div className="chain-row">
          {chain.map((id, i) => {
            const ls = lifeSpan(p, id);
            return (
              <Fragment key={id}>
                {i > 0 && (
                  <div className="chain-arrow" aria-hidden="true">
                    →
                  </div>
                )}
                <div
                  className={'chain-box' + (i === 0 ? ' root' : '')}
                  tabIndex={0}
                  role="button"
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest('.chain-edit')) return;
                    openDetail(id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') openDetail(id);
                  }}
                >
                  <div className="chain-name">{p[id].n}</div>
                  <div className="chain-role">{relLabel(i, p[id].s === 2)}</div>
                  {ls && <div className="chain-dates">{ls}</div>}
                  {ops && (
                    <div className="chain-edit">
                      <EditActions id={id} ops={ops} noDelete={i === 0} />
                    </div>
                  )}
                </div>
              </Fragment>
            );
          })}
        </div>

        <div className="spouse-row">
          {pillOwner &&
            (p[pillOwner].sp || [])
              .filter((s) => p[s])
              .map((spId) => {
                const label = p[spId].s === 1 ? 'муж' : 'жена';
                const ls = lifeSpan(p, spId);
                return (
                  <div
                    key={spId}
                    className="spouse-pill"
                    tabIndex={0}
                    role="button"
                    onClick={() => openDetail(spId)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') openDetail(spId);
                    }}
                  >
                    {label} · <b>{p[spId].n}</b>
                    {ls ? ' · ' + ls : ''}
                  </div>
                );
              })}
        </div>

        <div className="legend">
          <span>
            <i className="dot m" />
            мужчина
          </span>
          <span>
            <i className="dot f" />
            женщина
          </span>
          <span>
            <i className="dot dec" />
            ушёл(ла) из жизни
          </span>
        </div>

        <div className="section-head">
          <div>
            <h2 className="section-title">{branchTitle}</h2>
          </div>
          <div className="tree-tools">
            <button type="button" className="tbtn ghost" onClick={expandAll}>
              ⊕ всё
            </button>
            <button type="button" className="tbtn ghost" onClick={collapseAll}>
              ⊖ всё
            </button>
          </div>
        </div>
        <p className="section-sub">{branchSub}</p>

        <BranchList branchIds={branchIds} branchGen={branchGen} ctx={ctx} />

        <p className="footer-note">
          Шажара — интерактивное семейное древо.
          <br />
          Нажмите на любое имя, чтобы увидеть родственные связи.
        </p>
      </div>

      {selected && p[selected] && (
        <DetailModal
          p={p}
          root={root}
          id={selected}
          onClose={() => setSelected(null)}
          onGoto={(id) => setSelected(id)}
        />
      )}
    </div>
  );
}
