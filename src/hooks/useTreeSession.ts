import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, api } from '../lib/api';
import { fileToCompressedDataUrl } from '../lib/image';
import * as edit from '../lib/treeEdit';
import type { WorkingTree } from '../lib/treeEdit';
import type { Relation, Sex, Tree, TreeRole } from '../lib/types';

export type TreeSource = { kind: 'demo' } | { kind: 'tree'; id: number };
export type SessionMode = 'view' | 'owner' | 'proposal';

function errMsg(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error) return e.message;
  return 'Что-то пошло не так';
}

export interface TreeSession {
  tree: Tree | null;
  role: TreeRole | null;
  mode: SessionMode;
  loading: boolean;
  error: string | null;
  saveMsg: string;
  editable: boolean;
  photoBusy: boolean;
  dirty: boolean;
  reload: () => Promise<void>;
  flash: (m: string) => void;
  addRelative: (anchorId: string, relation: Relation, name: string, sex: Sex) => void;
  renamePerson: (id: string, name: string) => void;
  setSex: (id: string, sex: Sex) => void;
  setDates: (id: string, b: string, d: string) => void;
  setOrigin: (id: string, origin: string) => void;
  deletePerson: (id: string) => void;
  addPhotoFiles: (id: string, files: File[]) => Promise<void>;
  removePhoto: (id: string, index: number) => void;
  replaceWorking: (data: { root: string; p: Tree['p'] }) => void;
  submitProposal: (note?: string) => Promise<void>;
  discardProposal: () => Promise<void>;
}

export function useTreeSession(source: TreeSource | null): TreeSession {
  const [tree, setTree] = useState<Tree | null>(null);
  const [role, setRole] = useState<TreeRole | null>(null);
  const [mode, setMode] = useState<SessionMode>('view');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState('');
  const [photoBusy, setPhotoBusy] = useState(false);
  const [dirty, setDirty] = useState(false);

  const baseRef = useRef<WorkingTree | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The pending save carries its OWN target (tree id + mode) so a switch/mode-change
  // never routes a queued write to the wrong tree or endpoint.
  const pending = useRef<{ id: number; mode: SessionMode; data: { root: string; p: Tree['p'] } } | null>(
    null,
  );

  const flash = useCallback((msg: string) => {
    setSaveMsg(msg);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setSaveMsg(''), 1800);
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
    setDirty(false);
    try {
      if (source.kind === 'demo') {
        const { tree } = await api.demo();
        baseRef.current = null;
        setRole(null);
        setMode('view');
        setTree(tree);
      } else {
        const { tree: canon, role: r } = await api.getTree(source.id);
        setRole(r ?? 'owner');
        baseRef.current = { root: canon.root, p: canon.p };
        if (r === 'editor') {
          setMode('proposal');
          const { proposal } = await api.getDraft(source.id);
          const w = proposal ? proposal.data : canon;
          setTree({ ...canon, root: w.root, p: w.p });
          setDirty(!!proposal);
        } else {
          setMode('owner');
          setTree(canon);
        }
      }
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

  const flushSave = useCallback(async () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    const t = pending.current;
    pending.current = null;
    if (!t) return;
    try {
      if (t.mode === 'owner') {
        await api.replaceTree(t.id, t.data);
        flash('✓ Сохранено');
      } else if (t.mode === 'proposal') {
        await api.saveDraft(t.id, t.data);
        flash('✓ Черновик сохранён');
      }
    } catch (e) {
      flash('⚠ ' + errMsg(e));
    }
  }, [flash]);

  const scheduleSave = useCallback(
    (next: Tree) => {
      if (!source || source.kind !== 'tree') return;
      pending.current = { id: source.id, mode, data: { root: next.root, p: next.p } };
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => void flushSave(), 1000);
    },
    [source, mode, flushSave],
  );

  // Flush any queued save when the tree/mode changes or the component unmounts,
  // so a pending write is never dropped or misrouted.
  useEffect(() => {
    return () => {
      void flushSave();
    };
  }, [key, flushSave]);

  const applyEdit = useCallback(
    (fn: (t: WorkingTree) => WorkingTree) => {
      setTree((prev) => {
        if (!prev) return prev;
        try {
          const next = fn({ root: prev.root, p: prev.p });
          const merged: Tree = { ...prev, root: next.root, p: next.p };
          setDirty(true);
          scheduleSave(merged);
          return merged;
        } catch (e) {
          flash('⚠ ' + (e as Error).message);
          return prev;
        }
      });
    },
    [scheduleSave, flash],
  );

  const addRelative = useCallback(
    (anchorId: string, relation: Relation, name: string, sex: Sex) =>
      applyEdit((t) => edit.addRelative(t, anchorId, relation, name, sex)),
    [applyEdit],
  );
  const renamePerson = useCallback(
    (id: string, name: string) => applyEdit((t) => edit.renamePerson(t, id, name)),
    [applyEdit],
  );
  const setSex = useCallback(
    (id: string, sex: Sex) => applyEdit((t) => edit.setSex(t, id, sex)),
    [applyEdit],
  );
  const setDates = useCallback(
    (id: string, b: string, d: string) =>
      applyEdit((t) => edit.setField(edit.setField(t, id, 'b', b), id, 'd', d)),
    [applyEdit],
  );
  const setOrigin = useCallback(
    (id: string, origin: string) => applyEdit((t) => edit.setField(t, id, 'origin', origin)),
    [applyEdit],
  );
  const deletePerson = useCallback(
    (id: string) => applyEdit((t) => edit.deletePerson(t, id)),
    [applyEdit],
  );
  const removePhoto = useCallback(
    (id: string, index: number) => applyEdit((t) => edit.removePhoto(t, id, index)),
    [applyEdit],
  );
  const replaceWorking = useCallback(
    (data: { root: string; p: Tree['p'] }) => applyEdit(() => ({ root: data.root, p: data.p })),
    [applyEdit],
  );

  const addPhotoFiles = useCallback(
    async (id: string, files: File[]) => {
      const current = tree?.p[id]?.photos?.length ?? 0;
      const slots = 5 - current;
      if (slots <= 0) {
        alert('У этого человека уже максимум 5 фотографий.');
        return;
      }
      setPhotoBusy(true);
      try {
        for (const file of files.slice(0, slots)) {
          try {
            const url = await fileToCompressedDataUrl(file);
            applyEdit((t) => edit.addPhoto(t, id, url));
          } catch (e) {
            alert('Не удалось добавить фото: ' + (e as Error).message);
          }
        }
      } finally {
        setPhotoBusy(false);
      }
    },
    [tree, applyEdit],
  );

  const cancelPendingSave = () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    pending.current = null;
  };

  const submitProposal = useCallback(
    async (note?: string) => {
      if (mode !== 'proposal' || !source || source.kind !== 'tree' || !tree) return;
      cancelPendingSave();
      const data = { root: tree.root, p: tree.p };
      await api.saveDraft(source.id, data).catch(() => {});
      await api.submitProposal(source.id, data, note);
      setDirty(false);
      flash('✓ Отправлено на проверку');
    },
    [mode, source, tree, flash],
  );

  const discardProposal = useCallback(async () => {
    if (mode !== 'proposal' || !source || source.kind !== 'tree' || !baseRef.current || !tree) return;
    cancelPendingSave();
    const b = baseRef.current;
    setTree({ ...tree, root: b.root, p: b.p });
    setDirty(false);
    await api.saveDraft(source.id, { root: b.root, p: b.p }).catch(() => {});
    flash('Изменения отменены');
  }, [mode, source, tree, flash]);

  const editable = mode !== 'view';
  const dirtyOut = useMemo(() => (mode === 'proposal' ? dirty : false), [mode, dirty]);

  return {
    tree,
    role,
    mode,
    loading,
    error,
    saveMsg,
    editable,
    photoBusy,
    dirty: dirtyOut,
    reload,
    flash,
    addRelative,
    renamePerson,
    setSex,
    setDates,
    setOrigin,
    deletePerson,
    addPhotoFiles,
    removePhoto,
    replaceWorking,
    submitProposal,
    discardProposal,
  };
}
