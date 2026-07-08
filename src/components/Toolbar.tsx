import { useRef } from 'react';
import type { PeopleMap } from '../lib/types';

export interface ImportedTree {
  root: string;
  p: PeopleMap;
  title?: string;
}

export function Toolbar({
  editable,
  editMode,
  setEditMode,
  onExpand,
  onCollapse,
  onPng,
  onExportJson,
  onImportData,
  onRefresh,
  saveMsg,
}: {
  editable: boolean;
  editMode: boolean;
  setEditMode: (v: boolean) => void;
  onExpand: () => void;
  onCollapse: () => void;
  onPng: () => void;
  onExportJson: () => void;
  onImportData: (data: ImportedTree) => void;
  onRefresh: () => void;
  saveMsg: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (parsed && parsed.p && parsed.root) {
          onImportData(parsed);
        } else {
          alert('Неверный формат файла.');
        }
      } catch (err) {
        alert('Не удалось прочитать файл: ' + (err as Error).message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="toolbar">
      {editable && (
        <>
          <button
            type="button"
            className={'tbtn primary' + (editMode ? ' on' : '')}
            onClick={() => setEditMode(!editMode)}
            aria-pressed={editMode}
          >
            {editMode ? '✓ Режим правки' : '✎ Редактировать'}
          </button>
          <div className="sep" aria-hidden="true" />
        </>
      )}
      <button type="button" className="tbtn ghost" onClick={onExpand}>
        ⊕ Развернуть всё
      </button>
      <button type="button" className="tbtn ghost" onClick={onCollapse}>
        ⊖ Свернуть всё
      </button>
      <div className="sep" aria-hidden="true" />
      <button type="button" className="tbtn ghost" onClick={onPng} title="Сохранить древо как PNG">
        🖼 PNG
      </button>
      <button type="button" className="tbtn ghost" onClick={onExportJson}>
        ⭳ JSON
      </button>
      {editable && (
        <button type="button" className="tbtn ghost" onClick={() => fileRef.current?.click()}>
          ⭱ Импорт
        </button>
      )}
      <button
        type="button"
        className="tbtn ghost"
        onClick={onRefresh}
        title={editable ? 'Обновить с сервера' : 'Показать другую случайную семью'}
      >
        {editable ? '↺ Обновить' : '🎲 Другая семья'}
      </button>
      <input
        ref={fileRef}
        type="file"
        className="file-in"
        accept="application/json,.json"
        onChange={handleFile}
      />
      <span className={'save-indicator' + (saveMsg ? ' show' : '')} role="status" aria-live="polite">
        {saveMsg}
      </span>
    </div>
  );
}
