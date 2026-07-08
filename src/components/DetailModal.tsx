import { useCallback, useEffect, useRef, useState } from 'react';
import { genOf, lifeFull, lifeSpan, parentsOf, relLabel } from '../lib/treeUtils';
import type { PeopleMap, Person, Relation, Sex } from '../lib/types';
import { SexDot } from './shared';

const MAX_PHOTOS = 5;

export interface ModalEditOps {
  rename: (id: string, name: string) => void;
  setSex: (id: string, sex: Sex) => void;
  setDates: (id: string, b: string, d: string) => void;
  setOrigin: (id: string, origin: string) => void;
  addRelative: (anchorId: string, relation: Relation, name: string, sex: Sex) => void;
  remove: (id: string) => void;
  addPhotos: (id: string, files: File[]) => void;
  removePhoto: (id: string, index: number) => void;
}

function Chip({ p, id, onGoto }: { p: PeopleMap; id: string; onGoto: (id: string) => void }) {
  const person = p[id];
  if (!person) return null;
  const ls = lifeSpan(p, id);
  return (
    <button type="button" className="rel-chip" onClick={() => onGoto(id)}>
      <SexDot sex={person.s} deceased={!!person.d} />
      {person.n}
      {ls && <span className="yr"> {ls}</span>}
    </button>
  );
}

function RelBlock({
  label,
  p,
  ids,
  onGoto,
}: {
  label: string;
  p: PeopleMap;
  ids: string[];
  onGoto: (id: string) => void;
}) {
  const list = ids.filter((id) => p[id]);
  return (
    <div className="rel-block">
      <div className="rel-label">{label}</div>
      {list.length ? (
        <div className="rel-chips">
          {list.map((id) => (
            <Chip key={id} p={p} id={id} onGoto={onGoto} />
          ))}
        </div>
      ) : (
        <div className="rel-empty">нет данных</div>
      )}
    </div>
  );
}

function PhotoStrip({
  photos,
  editable,
  busy,
  onAdd,
  onRemove,
  onOpen,
}: {
  photos: string[];
  editable: boolean;
  busy: boolean;
  onAdd: (files: File[]) => void;
  onRemove: (index: number) => void;
  onOpen: (src: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const canAdd = editable && photos.length < MAX_PHOTOS;
  if (!photos.length && !editable) return null;
  return (
    <div className="photo-block">
      <div className="rel-label">
        Фотографии ({photos.length}/{MAX_PHOTOS})
      </div>
      <div className="photo-strip">
        {photos.map((src, i) => (
          <div className="photo" key={i}>
            <img src={src} alt={'Фото ' + (i + 1)} onClick={() => onOpen(src)} loading="lazy" />
            {editable && (
              <button
                type="button"
                className="photo-remove"
                title="Удалить фото"
                aria-label="Удалить фото"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(i);
                }}
              >
                ✕
              </button>
            )}
          </div>
        ))}
        {canAdd && (
          <button
            type="button"
            className="photo-add"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            title="Добавить фото"
          >
            <span className="photo-add-plus">{busy ? '…' : '＋'}</span>
            <span className="photo-add-lbl">{busy ? 'Загрузка…' : 'Фото'}</span>
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="file-in"
          onChange={(e) => {
            if (e.target.files && e.target.files.length) onAdd(Array.from(e.target.files));
            e.target.value = '';
          }}
        />
      </div>
    </div>
  );
}

const RELATIONS: [Relation, string][] = [
  ['child', 'Ребёнок'],
  ['spouse', 'Супруг(а)'],
  ['parent', 'Родитель'],
  ['sibling', 'Брат / сестра'],
];

function PersonEditPanel({
  id,
  person,
  isRoot,
  ops,
}: {
  id: string;
  person: Person;
  isRoot: boolean;
  ops: ModalEditOps;
}) {
  const [name, setName] = useState(person.n);
  const [b, setB] = useState(person.b || '');
  const [d, setD] = useState(person.d || '');
  const [origin, setOrigin] = useState(person.origin || '');
  const [addRel, setAddRel] = useState<Relation | null>(null);
  const [relName, setRelName] = useState('');
  const [relSex, setRelSex] = useState<Sex>(1);

  const commitName = () => {
    const v = name.trim();
    if (v && v !== person.n) ops.rename(id, v);
    else if (!v) setName(person.n);
  };
  const commitDates = () => {
    if (b !== (person.b || '') || d !== (person.d || '')) ops.setDates(id, b, d);
  };
  const commitOrigin = () => {
    if (origin !== (person.origin || '')) ops.setOrigin(id, origin);
  };
  const doAdd = () => {
    const v = relName.trim();
    if (!v || !addRel) return;
    ops.addRelative(id, addRel, v, relSex);
    setRelName('');
    setAddRel(null);
  };

  return (
    <div className="edit-panel">
      <div className="rel-label">Изменить</div>
      <label className="ef-row">
        <span>Имя</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
        />
      </label>
      <div className="ef-row">
        <span>Пол</span>
        <div className="seg">
          <button type="button" className={person.s === 1 ? 'on' : ''} onClick={() => ops.setSex(id, 1)}>
            ♂ муж
          </button>
          <button type="button" className={person.s === 2 ? 'on' : ''} onClick={() => ops.setSex(id, 2)}>
            ♀ жен
          </button>
        </div>
      </div>
      <div className="ef-two">
        <label className="ef-row">
          <span>Рождение</span>
          <input value={b} onChange={(e) => setB(e.target.value)} onBlur={commitDates} placeholder="1970" />
        </label>
        <label className="ef-row">
          <span>Смерть</span>
          <input value={d} onChange={(e) => setD(e.target.value)} onBlur={commitDates} placeholder="—" />
        </label>
      </div>
      <label className="ef-row">
        <span>Родовое место</span>
        <input value={origin} onChange={(e) => setOrigin(e.target.value)} onBlur={commitOrigin} placeholder="—" />
      </label>

      <div className="rel-label" style={{ marginTop: 16 }}>
        Добавить родственника
      </div>
      <div className="add-rel-btns">
        {RELATIONS.map(([r, l]) => (
          <button
            key={r}
            type="button"
            className={'tbtn ghost' + (addRel === r ? ' on' : '')}
            onClick={() => {
              setAddRel(addRel === r ? null : r);
              setRelName('');
            }}
          >
            {l}
          </button>
        ))}
      </div>
      {addRel && (
        <div className="add-rel-form">
          <input
            autoFocus
            value={relName}
            onChange={(e) => setRelName(e.target.value)}
            placeholder="Имя нового человека"
            onKeyDown={(e) => {
              if (e.key === 'Enter') doAdd();
            }}
          />
          <div className="seg small">
            <button type="button" className={relSex === 1 ? 'on' : ''} onClick={() => setRelSex(1)}>
              ♂
            </button>
            <button type="button" className={relSex === 2 ? 'on' : ''} onClick={() => setRelSex(2)}>
              ♀
            </button>
          </div>
          <button type="button" className="tbtn primary" onClick={doAdd}>
            Добавить
          </button>
        </div>
      )}

      {!isRoot && (
        <button type="button" className="tbtn danger-text del-btn" onClick={() => ops.remove(id)}>
          🗑 Удалить этого человека
        </button>
      )}
    </div>
  );
}

export function DetailModal({
  p,
  root,
  id,
  editable = false,
  photoBusy = false,
  ops,
  onClose,
  onGoto,
}: {
  p: PeopleMap;
  root: string;
  id: string;
  editable?: boolean;
  photoBusy?: boolean;
  ops?: ModalEditOps;
  onClose: () => void;
  onGoto: (id: string) => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);

  // Blur the focused field first so its onBlur commit fires before the modal unmounts.
  const close = useCallback(() => {
    const el = document.activeElement as HTMLElement | null;
    if (el && typeof el.blur === 'function') el.blur();
    onClose();
  }, [onClose]);

  useEffect(() => {
    closeRef.current?.focus();
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLightbox((lb) => {
          if (lb) return null;
          close();
          return null;
        });
      }
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [close]);

  const person = p[id];
  if (!person) return null;

  const parents = parentsOf(p, id);
  const spouses = (person.sp || []).slice();
  const kids = (person.c || []).slice();
  const photos = person.photos || [];
  const lf = lifeFull(p, id);
  const g = genOf(p, root, id);
  const genTxt = g !== Infinity ? ' · ' + relLabel(g, person.s === 2) : '';

  return (
    <div
      className="overlay show"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modalName"
      onClick={(e) => {
        if ((e.target as HTMLElement).classList.contains('overlay')) close();
      }}
    >
      <div className="modal">
        <div className="modal-top">
          <button ref={closeRef} className="modal-close" onClick={close} aria-label="Закрыть">
            ✕
          </button>
          <div className="modal-badge">
            {(person.s === 1 ? '♂ мужчина' : '♀ женщина') + (person.d ? ' · память' : '')}
          </div>
          <h3 className="modal-name" id="modalName">
            <SexDot sex={person.s} deceased={!!person.d} size={12} />
            {person.n}
          </h3>
          <div className="modal-life">{(lf || 'Даты жизни не указаны') + genTxt}</div>
        </div>
        <div className="modal-body">
          {(photos.length > 0 || editable) && ops && (
            <PhotoStrip
              photos={photos}
              editable={editable}
              busy={photoBusy}
              onAdd={(files) => ops.addPhotos(id, files)}
              onRemove={(i) => ops.removePhoto(id, i)}
              onOpen={(src) => setLightbox(src)}
            />
          )}
          {editable && ops && (
            <PersonEditPanel key={id} id={id} person={person} isRoot={id === root} ops={ops} />
          )}
          <RelBlock label="Родители" p={p} ids={parents} onGoto={onGoto} />
          <RelBlock label={person.s === 1 ? 'Супруга' : 'Супруг'} p={p} ids={spouses} onGoto={onGoto} />
          <RelBlock label={'Дети (' + kids.filter((k) => p[k]).length + ')'} p={p} ids={kids} onGoto={onGoto} />
        </div>
      </div>

      {lightbox && (
        <div
          className="lightbox"
          onClick={(e) => {
            e.stopPropagation();
            setLightbox(null);
          }}
        >
          <img src={lightbox} alt="Фото" />
        </div>
      )}
    </div>
  );
}
