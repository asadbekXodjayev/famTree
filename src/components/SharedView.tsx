import { useEffect, useRef, useState } from 'react';
import type { TreeSession } from '../hooks/useTreeSession';
import { TreeView } from './TreeView';

/**
 * Asks a share-link guest who they are before letting them edit.
 *
 * This is the only identity the tree will ever have for them, so it is a gate
 * rather than a prompt: no name, no edit rights. Kept deliberately light —
 * requiring an account here is exactly the friction the share link removes.
 */
function GuestNameGate({
  treeTitle,
  initial,
  onSubmit,
}: {
  treeTitle: string;
  initial: string;
  onSubmit: (name: string) => void;
}) {
  const [name, setName] = useState(initial);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const trimmed = name.trim();
  const submit = () => {
    if (trimmed) onSubmit(trimmed);
  };

  return (
    <div className="overlay show" role="dialog" aria-modal="true" aria-labelledby="guestGateTitle">
      <div className="modal guest-gate">
        <div className="modal-top">
          <div className="modal-badge">Приглашение к редактированию</div>
          <h3 className="modal-name" id="guestGateTitle">
            {treeTitle}
          </h3>
          <div className="modal-life">Вас пригласили дополнить это семейное древо</div>
        </div>
        <div className="modal-body">
          <p className="guest-gate-note">
            Аккаунт не нужен. Напишите, как вас зовут — ваше имя будет видно владельцу рядом с
            вашими правками.
          </p>
          <label className="ef-row">
            <span>Ваше имя</span>
            <input
              ref={inputRef}
              value={name}
              maxLength={60}
              placeholder="Например: Азиз ака"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit();
              }}
            />
          </label>
          <button type="button" className="tbtn primary guest-gate-go" disabled={!trimmed} onClick={submit}>
            Начать редактирование
          </button>
        </div>
      </div>
    </div>
  );
}

export function SharedView({ session }: { session: TreeSession }) {
  const [renaming, setRenaming] = useState(false);
  const isGuestEditor = session.mode === 'guest';
  const needsName = isGuestEditor && !session.guestName.trim();

  if (!session.tree) return null;

  return (
    <>
      <div className={'share-bar' + (isGuestEditor ? ' editable' : '')}>
        {isGuestEditor ? (
          <>
            <span>
              ✎ Вы редактируете по ссылке как <b>{session.guestName || '…'}</b>. Изменения
              сохраняются сразу и видны владельцу.
            </span>
            <button type="button" className="tbtn ghost" onClick={() => setRenaming(true)}>
              Изменить имя
            </button>
          </>
        ) : (
          <span>
            👁 Просмотр по ссылке. Это древо доступно только для чтения — чтобы вносить правки,
            попросите у владельца ссылку для редактирования.
          </span>
        )}
      </div>

      <TreeView session={session} />

      {(needsName || renaming) && (
        <GuestNameGate
          treeTitle={session.tree.title}
          initial={session.guestName}
          onSubmit={(n) => {
            session.setGuestName(n);
            setRenaming(false);
          }}
        />
      )}
    </>
  );
}
