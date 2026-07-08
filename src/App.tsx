import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { AuthModal } from './components/AuthModal';
import { TopBar } from './components/TopBar';
import { TreeView } from './components/TreeView';
import { useTree, type TreeSource } from './hooks/useTree';
import { api } from './lib/api';
import type { TreeSummary } from './lib/types';

function Splash({ text }: { text?: string }) {
  return (
    <div className="splash">
      <div className="splash-mark" aria-hidden="true">
        ۞
      </div>
      <div className="splash-text">{text || 'Загрузка…'}</div>
    </div>
  );
}

function ErrorBox({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="error-box">
      <p>{message}</p>
      <button type="button" className="tbtn primary" onClick={onRetry}>
        Повторить
      </button>
    </div>
  );
}

function Workspace() {
  const { user, status, logout } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [trees, setTrees] = useState<TreeSummary[]>([]);
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [treesLoading, setTreesLoading] = useState(false);
  const [treesError, setTreesError] = useState<string | null>(null);

  const loadTrees = useCallback(async (preferId?: number) => {
    setTreesLoading(true);
    setTreesError(null);
    try {
      const { trees } = await api.listTrees();
      setTrees(trees);
      setCurrentId((prev) => {
        const wanted = preferId ?? prev;
        if (wanted && trees.some((t) => t.id === wanted)) return wanted;
        return trees[0]?.id ?? null;
      });
    } catch (e) {
      setTreesError(e instanceof Error ? e.message : 'Не удалось загрузить древа');
    } finally {
      setTreesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === 'authed') {
      void loadTrees();
    } else if (status === 'anon') {
      setTrees([]);
      setCurrentId(null);
      setTreesError(null);
    }
  }, [status, loadTrees]);

  const source: TreeSource | null =
    status === 'authed'
      ? currentId != null
        ? { kind: 'tree', id: currentId }
        : null
      : status === 'anon'
        ? { kind: 'demo' }
        : null;

  const t = useTree(source);

  const onNew = async () => {
    try {
      const title = window.prompt('Название нового древа:', 'Моя шажара');
      if (title === null) return;
      const { tree } = await api.createTree(title.trim() || 'Моя шажара');
      await loadTrees(tree.id);
    } catch (e) {
      alert('Не удалось создать древо: ' + (e as Error).message);
    }
  };
  const onRename = async () => {
    if (currentId == null || !t.tree) return;
    try {
      const title = window.prompt('Новое название древа:', t.tree.title);
      if (!title || !title.trim()) return;
      await api.renameTree(currentId, title.trim());
      await loadTrees(currentId);
      await t.reload();
    } catch (e) {
      alert('Не удалось переименовать: ' + (e as Error).message);
    }
  };
  const onDelete = async () => {
    if (currentId == null || !t.tree) return;
    try {
      if (!window.confirm('Удалить древо «' + t.tree.title + '» полностью? Это необратимо.')) return;
      await api.deleteTree(currentId);
      setCurrentId(null);
      await loadTrees();
    } catch (e) {
      alert('Не удалось удалить древо: ' + (e as Error).message);
    }
  };

  if (status === 'loading') return <Splash />;

  const treeMatches =
    !!t.tree &&
    ((source?.kind === 'tree' && t.tree.id === source.id) ||
      (source?.kind === 'demo' && !!t.tree.demo));

  let main: ReactNode;
  if (status === 'authed' && treesLoading && trees.length === 0) {
    main = <Splash text="Открываем ваши древа…" />;
  } else if (status === 'authed' && treesError && trees.length === 0) {
    main = <ErrorBox message={treesError} onRetry={() => void loadTrees()} />;
  } else if (status === 'authed' && currentId == null) {
    main = (
      <div className="error-box">
        <p>У вас пока нет ни одного древа.</p>
        <button type="button" className="tbtn primary" onClick={() => void onNew()}>
          ＋ Создать древо
        </button>
      </div>
    );
  } else if (t.error && !treeMatches) {
    main = <ErrorBox message={t.error} onRetry={() => void t.reload()} />;
  } else if (treeMatches) {
    main = <TreeView key={source?.kind === 'tree' ? `t${source.id}` : 'demo'} t={t} />;
  } else {
    main = <Splash />;
  }

  return (
    <>
      <TopBar
        email={user?.email ?? null}
        trees={trees}
        currentId={currentId}
        onSelect={setCurrentId}
        onNew={() => void onNew()}
        onRename={() => void onRename()}
        onDelete={() => void onDelete()}
        onLogout={logout}
        onLoginClick={() => setAuthOpen(true)}
      />
      {main}
      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Workspace />
    </AuthProvider>
  );
}
