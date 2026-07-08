import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { AuthModal } from './components/AuthModal';
import { JoinBanner, ManageDialog, ReviewDialog, VersionsDialog } from './components/dialogs';
import { TopBar } from './components/TopBar';
import { TreeView } from './components/TreeView';
import { useTreeSession, type TreeSource } from './hooks/useTreeSession';
import { api } from './lib/api';
import type { TreeSummary } from './lib/types';

function Splash({ text }: { text?: string }) {
  return (
    <div className="splash">
      <div className="splash-mark" aria-hidden="true">
        ⌂
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

type Dialog = 'share' | 'history' | 'review' | null;

function Workspace() {
  const { user, status, logout } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [trees, setTrees] = useState<TreeSummary[]>([]);
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [treesLoading, setTreesLoading] = useState(false);
  const [treesError, setTreesError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [joinToken, setJoinToken] = useState<string | null>(() =>
    new URLSearchParams(window.location.search).get('invite'),
  );

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

  // Invite links: prompt sign-in if needed, then show the join banner.
  useEffect(() => {
    if (joinToken && status === 'anon') setAuthOpen(true);
  }, [joinToken, status]);

  const source: TreeSource | null =
    status === 'authed'
      ? currentId != null
        ? { kind: 'tree', id: currentId }
        : null
      : status === 'anon'
        ? { kind: 'demo' }
        : null;

  const session = useTreeSession(source);

  const currentSummary = useMemo(
    () => trees.find((t) => t.id === currentId) ?? null,
    [trees, currentId],
  );
  const pendingCount = currentSummary?.pendingCount ?? 0;

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
    if (currentId == null || !session.tree) return;
    try {
      const title = window.prompt('Новое название древа:', session.tree.title);
      if (!title || !title.trim()) return;
      await api.renameTree(currentId, title.trim());
      await loadTrees(currentId);
      await session.reload();
    } catch (e) {
      alert('Не удалось переименовать: ' + (e as Error).message);
    }
  };
  const onDelete = async () => {
    if (currentId == null || !session.tree) return;
    try {
      if (!window.confirm('Удалить древо «' + session.tree.title + '» полностью? Это необратимо.'))
        return;
      await api.deleteTree(currentId);
      setCurrentId(null);
      await loadTrees();
    } catch (e) {
      alert('Не удалось удалить древо: ' + (e as Error).message);
    }
  };

  const afterJoin = async (treeId: number) => {
    setJoinToken(null);
    window.history.replaceState(null, '', window.location.pathname);
    await loadTrees(treeId);
  };

  if (status === 'loading') return <Splash />;

  const treeMatches =
    !!session.tree &&
    ((source?.kind === 'tree' && session.tree.id === source.id) ||
      (source?.kind === 'demo' && !!session.tree.demo));

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
  } else if (session.error && !treeMatches) {
    main = <ErrorBox message={session.error} onRetry={() => void session.reload()} />;
  } else if (treeMatches) {
    main = <TreeView key={source?.kind === 'tree' ? `t${source.id}` : 'demo'} session={session} />;
  } else {
    main = <Splash />;
  }

  return (
    <>
      <TopBar
        email={user?.email ?? null}
        trees={trees}
        currentId={currentId}
        currentRole={session.role}
        pendingCount={pendingCount}
        onSelect={setCurrentId}
        onNew={() => void onNew()}
        onRename={() => void onRename()}
        onDelete={() => void onDelete()}
        onShare={() => setDialog('share')}
        onHistory={() => setDialog('history')}
        onReview={() => setDialog('review')}
        onLogout={logout}
        onLoginClick={() => setAuthOpen(true)}
      />
      {main}

      {dialog === 'share' && currentId != null && (
        <ManageDialog treeId={currentId} onClose={() => setDialog(null)} />
      )}
      {dialog === 'history' && currentId != null && (
        <VersionsDialog
          treeId={currentId}
          onClose={() => setDialog(null)}
          onRestored={() => {
            void session.reload();
            void loadTrees(currentId);
          }}
        />
      )}
      {dialog === 'review' && currentId != null && session.tree && (
        <ReviewDialog
          treeId={currentId}
          currentTree={session.tree}
          onClose={() => setDialog(null)}
          onAccepted={() => {
            void session.reload();
            void loadTrees(currentId);
          }}
        />
      )}

      {joinToken && status === 'authed' && (
        <JoinBanner
          token={joinToken}
          onDone={(treeId) => void afterJoin(treeId)}
          onDismiss={() => {
            setJoinToken(null);
            window.history.replaceState(null, '', window.location.pathname);
          }}
        />
      )}

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
