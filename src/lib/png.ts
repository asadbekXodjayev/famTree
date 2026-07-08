import type { PeopleMap } from './types';
import { genCount, lifeSpan } from './treeUtils';

interface Row {
  id: string;
  depth: number;
  parentIdx: number;
}

/**
 * Renders the whole tree to a warm-paper PNG and triggers a download.
 * Ported from the reference document's self-contained canvas renderer.
 */
export function exportTreePng(p: PeopleMap, root: string, fileName = 'shajara.png'): void {
  const rows: Row[] = [];
  const seen = new Set<string>();
  const dfs = (id: string, depth: number, parentIdx: number) => {
    if (!p[id] || seen.has(id)) return;
    seen.add(id);
    const idx = rows.length;
    rows.push({ id, depth, parentIdx });
    for (const c of p[id].c || []) dfs(c, depth + 1, idx);
  };
  dfs(root, 0, -1);

  const scale = Math.min(window.devicePixelRatio || 1, 2) * 1.5;
  const padX = 34;
  const padTop = 116;
  const padBottom = 46;
  const rowH = 34;
  const indent = 26;
  const dotR = 5;
  const cser = "500 17px Georgia,'Times New Roman',serif";
  const csans = '12px -apple-system,Segoe UI,Roboto,Arial,sans-serif';

  const spouseText = (id: string): string => {
    const list = (p[id].sp || []).filter((s) => p[s]);
    if (!list.length) return '';
    return (
      '  ⚭ ' +
      list
        .map((s) => {
          const ls = lifeSpan(p, s);
          return p[s].n + (ls ? ' (' + ls + ')' : '');
        })
        .join(', ')
    );
  };

  const meas = document.createElement('canvas').getContext('2d')!;
  let maxW = 560;
  let shownSpouses = 0;
  rows.forEach((r) => {
    const person = p[r.id];
    meas.font = cser;
    let w = r.depth * indent + padX + 18 + meas.measureText(person.n).width;
    const extra = lifeSpan(p, r.id);
    if (extra) {
      meas.font = csans;
      w += 12 + meas.measureText('  ·  ' + extra).width;
    }
    const sp = spouseText(r.id);
    if (sp) {
      meas.font = csans;
      w += meas.measureText(sp).width;
      shownSpouses += (p[r.id].sp || []).filter((s) => p[s]).length;
    }
    if (w > maxW) maxW = w;
  });

  const cssW = Math.ceil(maxW + padX + 30);
  const cssH = padTop + rows.length * rowH + padBottom;

  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(cssW * scale);
  canvas.height = Math.ceil(cssH * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);
  ctx.textBaseline = 'middle';

  ctx.fillStyle = '#F6F1E9';
  ctx.fillRect(0, 0, cssW, cssH);

  ctx.fillStyle = '#9C6B3E';
  ctx.font = '700 12px -apple-system,Segoe UI,Arial,sans-serif';
  ctx.fillText('РОДОСЛОВНАЯ · ШАЖАРА', padX, 34);
  ctx.fillStyle = '#2A241C';
  ctx.font = '400 30px Georgia,serif';
  ctx.fillText('Род ' + p[root].n, padX, 66);
  const origin = p[root].origin;
  ctx.fillStyle = '#6B6258';
  ctx.font = csans;
  const sub =
    rows.length +
    ' потомков + ' +
    shownSpouses +
    ' супругов · ' +
    genCount(p, root) +
    ' поколений' +
    (origin ? ' · ' + origin : '');
  ctx.fillText(sub, padX, 92);
  ctx.strokeStyle = '#E6DFD2';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padX, padTop - 14);
  ctx.lineTo(cssW - padX, padTop - 14);
  ctx.stroke();

  const xAt = (d: number) => padX + d * indent;
  const yAt = (i: number) => padTop + i * rowH + rowH / 2;

  ctx.strokeStyle = '#D8CEBB';
  ctx.lineWidth = 1;
  rows.forEach((r, i) => {
    if (r.parentIdx < 0) return;
    const px = xAt(r.depth - 1) + dotR + 2;
    const cy = yAt(i);
    ctx.beginPath();
    ctx.moveTo(px, yAt(r.parentIdx));
    ctx.lineTo(px, cy);
    ctx.lineTo(xAt(r.depth) - 2, cy);
    ctx.stroke();
  });

  rows.forEach((r, i) => {
    const person = p[r.id];
    const x = xAt(r.depth);
    const y = yAt(i);
    const deceased = !!person.d;
    ctx.beginPath();
    ctx.fillStyle = deceased ? '#9A9082' : person.s === 1 ? '#4A6FA1' : '#C1684A';
    ctx.arc(x + dotR, y, dotR, 0, Math.PI * 2);
    ctx.fill();
    let tx = x + dotR * 2 + 8;
    ctx.fillStyle = '#2A241C';
    ctx.font = cser;
    ctx.fillText(person.n, tx, y + 1);
    tx += ctx.measureText(person.n).width;
    const ls = lifeSpan(p, r.id);
    if (ls) {
      ctx.fillStyle = '#6B6258';
      ctx.font = csans;
      ctx.fillText('  ·  ' + ls, tx, y + 1);
      tx += ctx.measureText('  ·  ' + ls).width;
    }
    const sp = spouseText(r.id);
    if (sp) {
      ctx.fillStyle = '#8C5A45';
      ctx.font = csans;
      ctx.fillText(sp, tx, y + 1);
    }
  });

  ctx.fillStyle = '#9A9082';
  ctx.font = '11px -apple-system,Segoe UI,Arial,sans-serif';
  ctx.fillText('Построено из семейного архива', padX, cssH - 20);

  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }, 'image/png');
}
