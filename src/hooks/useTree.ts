import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, api } from '../lib/api';
import type { PeopleMap, Sex, Tree } from '../lib/types';

export type TreeSource = { kind: 'demo' } | { kind: 'tree'; id: number };

function errMsg(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error) return e.message;
  return 'Что-то пошло не так';
}

export interface UseTree {
  tree: Tree | null;
  loading: boolean;
  error: string | null;
  saveMsg: string;
  editable: boolean;
  reload: () => Promise<void>;
  flash: (msg: string) => void;
  addPerson: (anchorId: string, name: string, sex: Sex, asSpouse: boolean) => Promise<void>;
  renamePerson: (id: string, name: string) => Promise<void>;
  editDates: (id: string, b: string, d: string) => Promise<void>;
  deletePerson: (id: string) => Promise<void>;
  replaceTree: (data: { root: string; p: PeopleMap; title?: string }) => Promise<void>;
}

/** Loads a tree (or the public demo) and exposes edit ops that persist to the API. */
export function useTree(source: TreeSource | null): UseTree {
  const [tree, setTree] = useState<Tree | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState('');
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flash = useCallback((msg: string) => {
    setSaveMsg(msg);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setSaveMsg(''), 1600);
  }, []);

  const key = source ? (source.kind === 'demo' ? 'demo' : `tree:${source.id}`) : 'none';

  const reload = useCallback(async () => {
    if (!source) {
      setTree(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = source.kind === 'demo' ? await api.demo() : await api.getTree(source.id);
      setTree(res.tree);
    } catch (e) {
      setError(errMsg(e));
      setTree(null);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    reload();
  }, [reload]);

  const editable = source?.kind === 'tree';
  const treeId = source?.kind === 'tree' ? source.id : 0;

  const guardEditable = () => {
    if (!editable) throw new ApiError(403, 'Войдите, чтобы редактировать');
  };

  const run = useCallback(
    async (fn: () => Promise<Tree>, okMsg = '✓ Сохранено') => {
      try {
        guardEditable();
        const next = await fn();
        setTree(next);
        flash(okMsg);
      } catch (e) {
        // Surface via the flash indicator; do not re-throw (callers use `void`,
        // which would otherwise leak an unhandled promise rejection).
        flash('⚠ ' + errMsg(e));
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editable, flash],
  );

  const addPerson = useCallback(
    (anchorId: string, name: string, sex: Sex, asSpouse: boolean) =>
      run(async () => (await api.addPerson(treeId, anchorId, name, sex, asSpouse)).tree),
    [run, treeId],
  );

  const renamePerson = useCallback(
    (id: string, name: string) =>
      run(async () => (await api.updatePerson(treeId, id, { name })).tree),
    [run, treeId],
  );

  const editDates = useCallback(
    (id: string, b: string, d: string) =>
      run(async () => (await api.updatePerson(treeId, id, { b, d })).tree),
    [run, treeId],
  );

  const deletePerson = useCallback(
    (id: string) => run(async () => (await api.deletePerson(treeId, id)).tree, '✕ Удалено'),
    [run, treeId],
  );

  const replaceTree = useCallback(
    (data: { root: string; p: PeopleMap; title?: string }) =>
      run(async () => (await api.replaceTree(treeId, data)).tree, '⭱ Импортировано'),
    [run, treeId],
  );

  return {
    tree,
    loading,
    error,
    saveMsg,
    editable: !!editable,
    reload,
    flash,
    addPerson,
    renamePerson,
    editDates,
    deletePerson,
    replaceTree,
  };
}
