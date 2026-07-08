import type { TreeSummary } from '../lib/types';

export function TopBar({
  email,
  trees,
  currentId,
  onSelect,
  onNew,
  onRename,
  onDelete,
  onLogout,
  onLoginClick,
}: {
  email: string | null;
  trees: TreeSummary[];
  currentId: number | null;
  onSelect: (id: number) => void;
  onNew: () => void;
  onRename: () => void;
  onDelete: () => void;
  onLogout: () => void;
  onLoginClick: () => void;
}) {
  const authed = !!email;

  return (
    <div className="topbar">
      <div className="topbar-brand">
        <span className="brand-mark" aria-hidden="true">
          ⌂
        </span>
        <span className="brand-name">Шажара</span>
      </div>

      {authed ? (
        <div className="topbar-actions">
          {trees.length > 0 && (
            <select
              className="tree-select"
              value={currentId ?? ''}
              onChange={(e) => onSelect(Number(e.target.value))}
              aria-label="Выбрать древо"
            >
              {trees.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title} ({t.people})
                </option>
              ))}
            </select>
          )}
          <button type="button" className="tbtn ghost" onClick={onNew} title="Создать новое древо">
            ＋ Новое
          </button>
          {currentId != null && (
            <>
              <button type="button" className="tbtn ghost" onClick={onRename} title="Переименовать древо">
                ✎ Имя
              </button>
              <button
                type="button"
                className="tbtn ghost danger-text"
                onClick={onDelete}
                title="Удалить это древо"
              >
                🗑
              </button>
            </>
          )}
          <div className="sep" aria-hidden="true" />
          <span className="topbar-email" title={email ?? ''}>
            {email}
          </span>
          <button type="button" className="tbtn ghost" onClick={onLogout}>
            Выйти
          </button>
        </div>
      ) : (
        <div className="topbar-actions">
          <span className="demo-note">Демо · случайные данные</span>
          <button type="button" className="tbtn primary" onClick={onLoginClick}>
            Войти / Регистрация
          </button>
        </div>
      )}
    </div>
  );
}
