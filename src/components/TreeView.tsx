import { Fragment, useCallback, useMemo, useState } from 'react';
import type { TreeSession } from '../hooks/useTreeSession';
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
import { BranchList, type RenderCtx } from './Branches';
import { DetailModal, type ModalEditOps } from './DetailModal';
import { Hero } from './Hero';
import { Toolbar, type ImportedTree } from './Toolbar';

export function TreeView({ session }: { session: TreeSession }) {
  const tree = session.tree!;
  const p = tree.p;
  const root = tree.root;

  const [openSet, setOpenSet] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

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

  const canEditNow = session.editable && editMode;

  const ops: ModalEditOps | undefined = canEditNow
    ? {
        rename: session.renamePerson,
        setSex: session.setSex,
        setDates: session.setDates,
        setOrigin: session.setOrigin,
        addRelative: session.addRelative,
        remove: (id) => {
          const cnt = descCount(p, id, new Set());
          if (id === root) {
            alert('Родоначальника нельзя удалить.');
            return;
          }
          if (
            !window.confirm(
              '«' + p[id].n + '» и его потомков (' + cnt + ') удалить? Это действие необратимо.',
            )
          )
            return;
          session.deletePerson(id);
          if (selected === id) setSelected(null);
        },
        addPhotos: (id, files) => void session.addPhotoFiles(id, files),
        removePhoto: session.removePhoto,
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
    session.flash('⭳ Экспортировано');
  };

  const importData = (data: ImportedTree) => {
    session.replaceWorking({ root: data.root, p: data.p });
    setOpenSet(new Set());
    setSelected(null);
  };

  const submitProposal = async () => {
    const note = window.prompt('Комментарий для владельца (необязательно):', '');
    if (note === null) return;
    try {
      await session.submitProposal(note.trim() || undefined);
    } catch (e) {
      alert('Не удалось отправить: ' + (e as Error).message);
    }
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
    <div>
      <Toolbar
        editable={session.editable}
        editMode={editMode}
        setEditMode={setEditMode}
        onExpand={expandAll}
        onCollapse={collapseAll}
        onPng={() => exportTreePng(p, root)}
        onExportJson={exportJson}
        onImportData={importData}
        onRefresh={() => void session.reload()}
        saveMsg={session.saveMsg}
      />

      {session.mode === 'proposal' && (
        <div className="propose-bar">
          <span className="propose-note">
            ✎ Вы предлагаете изменения. Владелец увидит их после отправки.
            {session.dirty && <b> Есть несохранённые правки.</b>}
          </span>
          <div className="propose-actions">
            {session.dirty && (
              <button type="button" className="tbtn ghost" onClick={() => void session.discardProposal()}>
                Отменить правки
              </button>
            )}
            <button type="button" className="tbtn primary" onClick={() => void submitProposal()}>
              ⤴ Отправить на проверку
            </button>
          </div>
        </div>
      )}

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
                  onClick={() => openDetail(id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') openDetail(id);
                  }}
                >
                  <div className="chain-name">{p[id].n}</div>
                  <div className="chain-role">{relLabel(i, p[id].s === 2)}</div>
                  {ls && <div className="chain-dates">{ls}</div>}
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
          Нажмите на любое имя, чтобы открыть карточку и, в режиме правки, редактировать.
        </p>
      </div>

      {selected && p[selected] && (
        <DetailModal
          p={p}
          root={root}
          id={selected}
          editable={canEditNow}
          photoBusy={session.photoBusy}
          ops={ops}
          onClose={() => setSelected(null)}
          onGoto={(id) => setSelected(id)}
        />
      )}
    </div>
  );
}
