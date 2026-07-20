import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { diffTrees } from '../lib/treeEdit';
import type {
  Collaborator,
  Invite,
  PendingProposal,
  ShareActivity,
  ShareLink,
  ShareRole,
  Tree,
  VersionSummary,
} from '../lib/types';

function inviteUrl(token: string): string {
  return `${window.location.origin}/?invite=${token}`;
}
function shareUrl(token: string): string {
  return `${window.location.origin}/?share=${token}`;
}

function Shell({ title, subtitle, onClose, children }: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div
      className="overlay show"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if ((e.target as HTMLElement).classList.contains('overlay')) onClose();
      }}
    >
      <div className="modal dlg">
        <div className="modal-top">
          <button className="modal-close" onClick={onClose} aria-label="Закрыть">
            ✕
          </button>
          <h3 className="modal-name">{title}</h3>
          {subtitle && <div className="modal-life">{subtitle}</div>}
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

/* ------------------------------- Sharing -------------------------------- */

export function ManageDialog({ treeId, onClose }: { treeId: number; onClose: () => void }) {
  const [collabs, setCollabs] = useState<Collaborator[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [shares, setShares] = useState<ShareLink[]>([]);
  const [activity, setActivity] = useState<ShareActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [c, i, s, a] = await Promise.all([
        api.listCollaborators(treeId),
        api.listInvites(treeId),
        api.listShares(treeId),
        api.listActivity(treeId),
      ]);
      setCollabs(c.collaborators);
      setInvites(i.invites);
      setShares(s.shares);
      setActivity(a.activity);
    } finally {
      setLoading(false);
    }
  };

  const createShare = async (role: ShareRole) => {
    try {
      await api.createShare(treeId, role);
      await load();
    } catch (e) {
      alert('Не удалось создать ссылку: ' + (e as Error).message);
    }
  };
  const revokeShareLink = async (id: number, role: ShareRole) => {
    const msg =
      role === 'edit'
        ? 'Отозвать эту ссылку? Все, у кого она есть, потеряют доступ к редактированию.'
        : 'Отозвать эту ссылку для просмотра?';
    if (!window.confirm(msg)) return;
    await api.revokeShare(treeId, id);
    await load();
  };
  const copyShare = async (token: string) => {
    try {
      await navigator.clipboard.writeText(shareUrl(token));
      setCopied(token);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard blocked — the field is selectable as a fallback */
    }
  };
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [treeId]);

  const createLink = async () => {
    await api.createInvite(treeId);
    await load();
  };
  const copy = async (token: string) => {
    try {
      await navigator.clipboard.writeText(inviteUrl(token));
      setCopied(token);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard blocked */
    }
  };
  const revoke = async (id: number) => {
    await api.revokeInvite(treeId, id);
    await load();
  };
  const removeCollab = async (userId: number) => {
    if (!window.confirm('Убрать этого редактора?')) return;
    await api.removeCollaborator(treeId, userId);
    await load();
  };

  const viewLinks = shares.filter((s) => s.role === 'view');
  const editLinks = shares.filter((s) => s.role === 'edit');

  const linkRow = (s: ShareLink) => (
    <div className="dlg-row invite-row" key={s.id}>
      <input readOnly value={shareUrl(s.token)} onFocus={(e) => e.target.select()} />
      <button className="tbtn ghost" onClick={() => void copyShare(s.token)}>
        {copied === s.token ? '✓' : 'Копир.'}
      </button>
      <button
        className="tbtn ghost danger-text"
        title="Отозвать ссылку"
        aria-label="Отозвать ссылку"
        onClick={() => void revokeShareLink(s.id, s.role)}
      >
        ✕
      </button>
    </div>
  );

  return (
    <Shell
      title="Поделиться древом"
      subtitle="Ссылки работают без регистрации — просто отправьте их родственникам"
      onClose={onClose}
    >
      <div className="rel-label">🔗 Ссылка для просмотра ({viewLinks.length})</div>
      <button type="button" className="tbtn" onClick={() => void createShare('view')}>
        ＋ Создать ссылку для просмотра
      </button>
      <div className="dlg-list" style={{ marginTop: 10 }}>{viewLinks.map(linkRow)}</div>
      <p className="dlg-hint">Открывший увидит древо, но ничего не сможет изменить.</p>

      <div className="rel-label" style={{ marginTop: 18 }}>
        ✎ Ссылка для редактирования ({editLinks.length})
      </div>
      <button type="button" className="tbtn primary" onClick={() => void createShare('edit')}>
        ＋ Создать ссылку для редактирования
      </button>
      <div className="dlg-list" style={{ marginTop: 10 }}>{editLinks.map(linkRow)}</div>
      <p className="dlg-hint">
        <b>Отправляйте только тем, кому доверяете.</b> Любой, у кого есть эта ссылка, сможет менять
        древо без регистрации — он лишь укажет своё имя. Все правки видны ниже, а откатить их можно
        в разделе «История».
      </p>

      {activity.length > 0 && (
        <>
          <div className="rel-label" style={{ marginTop: 18 }}>
            Правки по ссылке
          </div>
          <div className="dlg-list">
            {activity.slice(0, 12).map((a) => {
              const delta = a.peopleAfter - a.peopleBefore;
              const change =
                delta > 0 ? `+${delta} чел.` : delta < 0 ? `${delta} чел.` : 'правки без новых людей';
              return (
                <div className="dlg-row" key={a.id}>
                  <span>
                    <b>{a.guestName}</b> · {change}
                  </span>
                  <span className="dlg-when">{new Date(a.createdAt + 'Z').toLocaleString('ru')}</span>
                </div>
              );
            })}
          </div>
        </>
      )}

      <div className="rel-label" style={{ marginTop: 22 }}>
        Редакторы с аккаунтом ({collabs.length})
      </div>
      {loading ? (
        <div className="rel-empty">Загрузка…</div>
      ) : collabs.length ? (
        <div className="dlg-list">
          {collabs.map((c) => (
            <div className="dlg-row" key={c.userId}>
              <span>{c.email}</span>
              <button className="tbtn ghost danger-text" onClick={() => void removeCollab(c.userId)}>
                убрать
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="rel-empty">Пока никого — создайте ссылку-приглашение</div>
      )}

      <div className="rel-label" style={{ marginTop: 18 }}>
        Ссылки-приглашения
      </div>
      <button type="button" className="tbtn primary" onClick={() => void createLink()}>
        ＋ Создать ссылку-приглашение
      </button>
      <div className="dlg-list" style={{ marginTop: 10 }}>
        {invites.map((inv) => (
          <div className="dlg-row invite-row" key={inv.id}>
            <input readOnly value={inviteUrl(inv.token)} onFocus={(e) => e.target.select()} />
            <button className="tbtn ghost" onClick={() => void copy(inv.token)}>
              {copied === inv.token ? '✓' : 'Копир.'}
            </button>
            <button className="tbtn ghost danger-text" onClick={() => void revoke(inv.id)}>
              ✕
            </button>
          </div>
        ))}
      </div>
      <p className="dlg-hint">
        Отправьте ссылку родственнику. Открыв её и войдя в аккаунт, он сможет предлагать изменения —
        вы увидите их в разделе «Предложения» и сможете принять или отклонить.
      </p>
    </Shell>
  );
}

/* ------------------------------- Versions ------------------------------- */

export function VersionsDialog({
  treeId,
  onClose,
  onRestored,
}: {
  treeId: number;
  onClose: () => void;
  onRestored: () => void;
}) {
  const [versions, setVersions] = useState<VersionSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const { versions } = await api.listVersions(treeId);
      setVersions(versions);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [treeId]);

  const checkpoint = async () => {
    const note = window.prompt('Название точки восстановления (необязательно):', '');
    if (note === null) return;
    await api.checkpoint(treeId, note.trim() || undefined);
    await load();
  };
  const restore = async (vid: number) => {
    if (!window.confirm('Восстановить это состояние древа? Текущее сохранится в истории.')) return;
    await api.restoreVersion(treeId, vid);
    onRestored();
    onClose();
  };

  return (
    <Shell title="История изменений" subtitle="Откатитесь к любому сохранённому состоянию" onClose={onClose}>
      <button type="button" className="tbtn primary" onClick={() => void checkpoint()}>
        ＋ Создать точку восстановления
      </button>
      <div className="dlg-list" style={{ marginTop: 12 }}>
        {loading ? (
          <div className="rel-empty">Загрузка…</div>
        ) : versions.length ? (
          versions.map((v) => (
            <div className="dlg-row version-row" key={v.id}>
              <div className="version-info">
                <b>{v.note || v.title}</b>
                <span className="version-meta">
                  {v.people} чел. · {v.createdAt}
                  {v.createdByEmail ? ' · ' + v.createdByEmail : ''}
                </span>
              </div>
              <button className="tbtn ghost" onClick={() => void restore(v.id)}>
                ↺ Восстановить
              </button>
            </div>
          ))
        ) : (
          <div className="rel-empty">Пока нет сохранённых точек. Они создаются автоматически при
            принятии предложений и откатах.</div>
        )}
      </div>
    </Shell>
  );
}

/* ------------------------------- Review --------------------------------- */

export function ReviewDialog({
  treeId,
  currentTree,
  onClose,
  onAccepted,
}: {
  treeId: number;
  currentTree: Tree;
  onClose: () => void;
  onAccepted: () => void;
}) {
  const [proposals, setProposals] = useState<PendingProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<number | null>(null);
  const [detail, setDetail] = useState<{ data: Tree; note: string | null } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { proposals } = await api.listProposals(treeId);
      setProposals(proposals);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [treeId]);

  const open = async (pid: number) => {
    setOpenId(pid);
    setDetail(null);
    const { proposal } = await api.getProposal(pid);
    setDetail({ data: proposal.data, note: proposal.note });
  };

  const diff = useMemo(() => {
    if (!detail) return null;
    return diffTrees(
      { root: currentTree.root, p: currentTree.p },
      { root: detail.data.root, p: detail.data.p },
    );
  }, [detail, currentTree]);

  const accept = async (pid: number) => {
    setBusy(true);
    try {
      await api.acceptProposal(pid);
      onAccepted();
      setOpenId(null);
      setDetail(null);
      await load();
    } catch (e) {
      alert('Не удалось принять: ' + (e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const reject = async (pid: number) => {
    if (!window.confirm('Отклонить это предложение?')) return;
    setBusy(true);
    try {
      await api.rejectProposal(pid);
      setOpenId(null);
      setDetail(null);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const names = (ids: string[], from: Tree) =>
    ids
      .map((id) => from.p[id]?.n)
      .filter(Boolean)
      .slice(0, 8)
      .join(', ');

  return (
    <Shell title="Предложения на проверке" subtitle="Изменения от редакторов" onClose={onClose}>
      {loading ? (
        <div className="rel-empty">Загрузка…</div>
      ) : !proposals.length ? (
        <div className="rel-empty">Нет предложений на рассмотрении</div>
      ) : (
        <div className="dlg-list">
          {proposals.map((pr) => (
            <div className="proposal-item" key={pr.id}>
              <div className="dlg-row" onClick={() => void open(pr.id)} style={{ cursor: 'pointer' }}>
                <div className="version-info">
                  <b>{pr.proposerEmail}</b>
                  <span className="version-meta">
                    {pr.note ? '«' + pr.note + '» · ' : ''}
                    {pr.people} чел. · {pr.updatedAt}
                  </span>
                </div>
                <span className="branch-chevron" style={{ transform: openId === pr.id ? 'rotate(90deg)' : '' }}>
                  ›
                </span>
              </div>
              {openId === pr.id && (
                <div className="proposal-detail">
                  {!detail ? (
                    <div className="rel-empty">Загрузка…</div>
                  ) : !diff ? null : (
                    <>
                      <div className="diff-summary">
                        <span className="diff added">＋ добавлено: {diff.added.length}</span>
                        <span className="diff changed">✎ изменено: {diff.changed.length}</span>
                        <span className="diff removed">✕ удалено: {diff.removed.length}</span>
                      </div>
                      {diff.added.length > 0 && (
                        <div className="diff-names">Новые: {names(diff.added, detail.data)}</div>
                      )}
                      {diff.removed.length > 0 && (
                        <div className="diff-names">Удалены: {names(diff.removed, currentTree)}</div>
                      )}
                      <div className="proposal-actions">
                        <button
                          type="button"
                          className="tbtn primary"
                          disabled={busy}
                          onClick={() => void accept(pr.id)}
                        >
                          ✓ Принять и объединить
                        </button>
                        <button
                          type="button"
                          className="tbtn ghost danger-text"
                          disabled={busy}
                          onClick={() => void reject(pr.id)}
                        >
                          Отклонить
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
}

/* ------------------------------ Join banner ----------------------------- */

export function JoinBanner({
  token,
  onDone,
  onDismiss,
}: {
  token: string;
  onDone: (treeId: number) => void;
  onDismiss: () => void;
}) {
  const [info, setInfo] = useState<{ title: string; ownerEmail: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .previewInvite(token)
      .then((r) => setInfo({ title: r.title, ownerEmail: r.ownerEmail }))
      .catch((e) => setError((e as Error).message));
  }, [token]);

  const accept = async () => {
    setBusy(true);
    try {
      const { treeId } = await api.acceptInvite(token);
      onDone(treeId);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell title="Приглашение к редактированию" onClose={onDismiss}>
      {error ? (
        <div className="auth-error">{error}</div>
      ) : !info ? (
        <div className="rel-empty">Загрузка…</div>
      ) : (
        <>
          <p>
            <b>{info.ownerEmail}</b> приглашает вас редактировать древо «<b>{info.title}</b>». Ваши
            изменения попадут на проверку владельцу.
          </p>
          <div className="proposal-actions">
            <button type="button" className="tbtn primary" disabled={busy} onClick={() => void accept()}>
              Принять приглашение
            </button>
            <button type="button" className="tbtn ghost" onClick={onDismiss}>
              Позже
            </button>
          </div>
        </>
      )}
    </Shell>
  );
}
