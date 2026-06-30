import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import type { LayoutNode, Connection, Person } from '../lib/types';

const SCALE   = 110;
const NODE_R  = 24;
const ROOT_R  = 38;
const GOLD    = '#C9A227';
const MALE_C  = '#5B8DD9';
const FEMALE_C = '#D4826A';
const NODE_BG = '#0e0a04';
const MIN_Z   = 0.12;
const MAX_Z   = 3.2;

interface Props {
  nodes: LayoutNode[];
  connections: Connection[];
  rootId: string;
  onSelectPerson: (person: Person | null) => void;
}

type Tf = { x: number; y: number; z: number };

export function TreeCanvas({ nodes, connections, onSelectPerson }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Keep transform in both ref (for gesture handlers) and state (for render)
  const tfRef   = useRef<Tf>({ x: 0, y: 0, z: 0.8 });
  const [tf, setTf] = useState<Tf>({ x: 0, y: 0, z: 0.8 });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [smoothNav, setSmoothNav]   = useState(false);
  const [isGrabbing, setIsGrabbing] = useState(false);

  const isDragging  = useRef(false);
  const wasDragged  = useRef(false);
  const dragOrigin  = useRef({ mx: 0, my: 0, px: 0, py: 0 });
  const pinchState  = useRef<{ dist: number; mx: number; my: number } | null>(null);
  const nodesRef    = useRef(nodes);
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);

  // ── helpers ──────────────────────────────────────────────────────────────

  const commit = useCallback((next: Tf, smooth = false) => {
    tfRef.current = next;
    if (smooth) {
      setSmoothNav(true);
      setTimeout(() => setSmoothNav(false), 420);
    }
    setTf({ ...next });
  }, []);

  const zoomAt = useCallback((sx: number, sy: number, factor: number) => {
    const cur = tfRef.current;
    const newZ = Math.min(MAX_Z, Math.max(MIN_Z, cur.z * factor));
    const r = newZ / cur.z;
    commit({ x: sx - (sx - cur.x) * r, y: sy - (sy - cur.y) * r, z: newZ });
  }, [commit]);

  // ── initialise view ───────────────────────────────────────────────────────

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();

    // Compute bounding box of the tree in world pixels
    let minX = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of nodesRef.current) {
      const wx = n.position[0] * SCALE;
      const wy = -n.position[1] * SCALE;
      if (wx < minX) minX = wx;
      if (wx > maxX) maxX = wx;
      if (wy > maxY) maxY = wy;
    }
    const treeW = (maxX - minX) + NODE_R * 6;
    const treeH = maxY + ROOT_R * 4;

    // Fit the tree to 90% of the viewport, but cap so it's not huge on desktop
    const zFit = Math.min((width * 0.92) / treeW, (height * 0.82) / treeH);
    const z    = Math.min(0.88, Math.max(0.14, zFit));

    // Centre the tree horizontally, root near top
    const cx = (minX + maxX) / 2;
    commit({ x: width / 2 - cx * z, y: height * 0.1 + ROOT_R * z, z });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── wheel ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) {
        zoomAt(e.clientX - rect.left, e.clientY - rect.top, Math.exp(-e.deltaY * 0.004));
      } else {
        const cur = tfRef.current;
        commit({ ...cur, x: cur.x - e.deltaX, y: cur.y - e.deltaY });
      }
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [commit, zoomAt]);

  // ── mouse ─────────────────────────────────────────────────────────────────

  const onMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    isDragging.current = true;
    wasDragged.current = false;
    setIsGrabbing(true);
    const cur = tfRef.current;
    dragOrigin.current = { mx: e.clientX, my: e.clientY, px: cur.x, py: cur.y };
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - dragOrigin.current.mx;
    const dy = e.clientY - dragOrigin.current.my;
    if (Math.abs(dx) + Math.abs(dy) > 4) wasDragged.current = true;
    const cur = tfRef.current;
    commit({ ...cur, x: dragOrigin.current.px + dx, y: dragOrigin.current.py + dy });
  };

  const onMouseUp = () => { isDragging.current = false; setIsGrabbing(false); };

  // ── touch ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onTStart = (e: TouchEvent) => {
      e.preventDefault();
      wasDragged.current = false;
      if (e.touches.length === 1) {
        isDragging.current = true;
        const cur = tfRef.current;
        dragOrigin.current = {
          mx: e.touches[0].clientX,
          my: e.touches[0].clientY,
          px: cur.x,
          py: cur.y,
        };
        pinchState.current = null;
      } else if (e.touches.length === 2) {
        isDragging.current = false;
        const dx = e.touches[1].clientX - e.touches[0].clientX;
        const dy = e.touches[1].clientY - e.touches[0].clientY;
        pinchState.current = {
          dist: Math.sqrt(dx * dx + dy * dy),
          mx: (e.touches[0].clientX + e.touches[1].clientX) / 2,
          my: (e.touches[0].clientY + e.touches[1].clientY) / 2,
        };
      }
    };

    const onTMove = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length === 1 && isDragging.current) {
        const dx = e.touches[0].clientX - dragOrigin.current.mx;
        const dy = e.touches[0].clientY - dragOrigin.current.my;
        if (Math.abs(dx) + Math.abs(dy) > 8) wasDragged.current = true;
        const cur = tfRef.current;
        commit({ ...cur, x: dragOrigin.current.px + dx, y: dragOrigin.current.py + dy });
      } else if (e.touches.length === 2 && pinchState.current) {
        const dx = e.touches[1].clientX - e.touches[0].clientX;
        const dy = e.touches[1].clientY - e.touches[0].clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        const factor = dist / pinchState.current.dist;
        const dmx = midX - pinchState.current.mx;
        const dmy = midY - pinchState.current.my;
        const rect = el.getBoundingClientRect();
        const sx = midX - rect.left;
        const sy = midY - rect.top;
        const cur = tfRef.current;
        const newZ = Math.min(MAX_Z, Math.max(MIN_Z, cur.z * factor));
        const r = newZ / cur.z;
        commit({ x: sx - (sx - cur.x) * r + dmx, y: sy - (sy - cur.y) * r + dmy, z: newZ });
        pinchState.current = { dist, mx: midX, my: midY };
      }
    };

    const onTEnd = (e: TouchEvent) => {
      // Tap detection → select nearest node
      if (!wasDragged.current && !pinchState.current && e.changedTouches.length === 1) {
        const touch = e.changedTouches[0];
        const rect  = el.getBoundingClientRect();
        const sx = touch.clientX - rect.left;
        const sy = touch.clientY - rect.top;
        const cur = tfRef.current;
        const wx = (sx - cur.x) / cur.z;
        const wy = (sy - cur.y) / cur.z;
        let closest: LayoutNode | null = null;
        let bestD = 9999;
        for (const n of nodesRef.current) {
          const nwx = n.position[0] * SCALE;
          const nwy = -n.position[1] * SCALE;
          const d = Math.sqrt((wx - nwx) ** 2 + (wy - nwy) ** 2);
          const r = n.generation === 0 ? ROOT_R : NODE_R;
          if (d < r * 1.6 && d < bestD) { bestD = d; closest = n; }
        }
        if (closest) selectNode(closest);
      }
      if (e.touches.length === 0) {
        isDragging.current = false;
        pinchState.current = null;
      }
    };

    el.addEventListener('touchstart',  onTStart, { passive: false });
    el.addEventListener('touchmove',   onTMove,  { passive: false });
    el.addEventListener('touchend',    onTEnd,   { passive: false });
    el.addEventListener('touchcancel', onTEnd,   { passive: false });
    return () => {
      el.removeEventListener('touchstart',  onTStart);
      el.removeEventListener('touchmove',   onTMove);
      el.removeEventListener('touchend',    onTEnd);
      el.removeEventListener('touchcancel', onTEnd);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── node selection + fly-to ───────────────────────────────────────────────

  const selectNode = useCallback((node: LayoutNode) => {
    setSelectedId(node.id);
    onSelectPerson(node.person);
    const el = containerRef.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const wx = node.position[0] * SCALE;
    const wy = -node.position[1] * SCALE;
    const cur = tfRef.current;
    // Ensure the node is rendered at a readable size when focused
    const minReadable = Math.min(0.65, width / 800);
    const z = Math.max(cur.z, minReadable);
    commit(
      { x: width / 2 - wx * z, y: height * 0.38 - wy * z, z },
      true
    );
  }, [commit, onSelectPerson]);

  // ── BFS traversal order ───────────────────────────────────────────────────

  const traversal = useMemo(() => {
    const genMap = new Map<number, LayoutNode[]>();
    for (const n of nodes) {
      if (!genMap.has(n.generation)) genMap.set(n.generation, []);
      genMap.get(n.generation)!.push(n);
    }
    const order: string[] = [];
    for (const g of Array.from(genMap.keys()).sort((a, b) => a - b)) {
      for (const n of genMap.get(g)!.sort((a, b) => a.position[0] - b.position[0]))
        order.push(n.id);
    }
    return order;
  }, [nodes]);

  const navIdx = selectedId != null ? traversal.indexOf(selectedId) : -1;

  const navToId = useCallback((id: string) => {
    const node = nodes.find(n => n.id === id);
    if (node) selectNode(node);
  }, [nodes, selectNode]);

  const navPrev = useCallback(() => {
    const i = navIdx <= 0 ? traversal.length - 1 : navIdx - 1;
    navToId(traversal[i]);
  }, [navIdx, traversal, navToId]);

  const navNext = useCallback(() => {
    const i = navIdx < 0 || navIdx >= traversal.length - 1 ? 0 : navIdx + 1;
    navToId(traversal[i]);
  }, [navIdx, traversal, navToId]);

  const resetView = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const z = Math.min(0.9, width / 1500);
    commit({ x: width / 2, y: height * 0.12 + 36, z }, true);
    setSelectedId(null);
    onSelectPerson(null);
  }, [commit, onSelectPerson]);

  // ── keyboard ──────────────────────────────────────────────────────────────

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const cw = containerRef.current?.clientWidth  ?? 600;
      const ch = containerRef.current?.clientHeight ?? 400;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown')  { e.preventDefault(); navNext(); }
      if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')    { e.preventDefault(); navPrev(); }
      if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomAt(cw/2, ch/2, 1.25); }
      if (e.key === '-' || e.key === '_') { e.preventDefault(); zoomAt(cw/2, ch/2, 0.8);  }
      if (e.key === 'Escape')             { setSelectedId(null); onSelectPerson(null); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [navNext, navPrev, zoomAt, onSelectPerson]);

  // ── LOD thresholds ────────────────────────────────────────────────────────

  const showLabel  = tf.z > 0.32;
  const labelSize  = tf.z > 0.55;
  const genCount   = useMemo(() => Math.max(...nodes.map(n => n.generation)) + 1, [nodes]);
  const selNode    = selectedId != null ? nodes.find(n => n.id === selectedId) : null;

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        cursor: isGrabbing ? 'grabbing' : 'grab',
        touchAction: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      {/* Radial ambient glow */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 60% 55% at 50% 35%, rgba(201,162,39,0.055) 0%, transparent 70%)',
      }} />

      {/* Panning canvas */}
      <div
        style={{
          position: 'absolute',
          transformOrigin: '0 0',
          transform: `translate(${tf.x}px,${tf.y}px) scale(${tf.z})`,
          transition: smoothNav ? 'transform 0.38s cubic-bezier(0.22,1,0.36,1)' : 'none',
          willChange: 'transform',
        }}
      >
        <svg
          style={{ overflow: 'visible', display: 'block' }}
          width="1"
          height="1"
          aria-label="Шажара дарахти"
        >
          {/* ── Connection lines ── */}
          <g>
            {connections.map(c => {
              const fx = c.fromPos[0] * SCALE;
              const fy = -c.fromPos[1] * SCALE;
              const tx = c.toPos[0] * SCALE;
              const ty = -c.toPos[1] * SCALE;
              const my = (fy + ty) / 2;
              const d = `M ${fx} ${fy} C ${fx} ${my}, ${tx} ${my}, ${tx} ${ty}`;
              const isSel =
                (c.fromId === selectedId || c.toId === selectedId) ||
                (selNode != null &&
                  (selNode.person.children.includes(c.toId) ||
                   c.toId === selNode.id));
              return (
                <path
                  key={c.id}
                  d={d}
                  fill="none"
                  stroke={isSel ? GOLD : GOLD}
                  strokeWidth={isSel ? 2.2 : 1.4}
                  strokeOpacity={isSel ? 0.7 : 0.28}
                />
              );
            })}
          </g>

          {/* ── Nodes ── */}
          {nodes.map(node => {
            const wx = node.position[0] * SCALE;
            const wy = -node.position[1] * SCALE;
            const isRoot = node.generation === 0;
            const r      = isRoot ? ROOT_R : NODE_R;
            const isSel  = node.id === selectedId;
            const accent = node.person.sex === 1 ? MALE_C : FEMALE_C;
            const fs     = isRoot ? 15 : labelSize ? 12 : 10;

            return (
              <g
                key={node.id}
                transform={`translate(${wx},${wy})`}
                onClick={e => { if (wasDragged.current) return; e.stopPropagation(); selectNode(node); }}
                style={{ cursor: 'pointer' }}
                role="button"
                aria-label={node.person.name}
              >
                {/* Selection halo */}
                {isSel && <circle r={r + 18} fill={accent} opacity={0.11} />}

                {/* Root extra glow */}
                {isRoot && !isSel && <circle r={r + 12} fill={GOLD} opacity={0.06} />}

                {/* Outer ring */}
                <circle
                  r={r + 5}
                  fill="none"
                  stroke={isSel ? accent : GOLD}
                  strokeWidth={isSel ? 2.2 : 1.2}
                  strokeOpacity={isSel ? 1 : 0.5}
                />

                {/* Node body */}
                <circle r={r} fill={NODE_BG} />

                {/* Inner detail for root */}
                {isRoot && (
                  <circle r={r - 10} fill="none" stroke={GOLD} strokeWidth={1} strokeOpacity={0.45} />
                )}

                {/* Sex dot */}
                <circle cx={0} cy={-(r + 2)} r={isRoot ? 5.5 : 4} fill={accent} />

                {/* Label */}
                {showLabel && (
                  <text
                    y={r + (labelSize ? 18 : 14)}
                    textAnchor="middle"
                    fill="#F0E8D0"
                    fontSize={fs}
                    fontFamily="Georgia, 'Times New Roman', serif"
                    opacity={labelSize ? 0.9 : 0.65}
                    style={{ pointerEvents: 'none' }}
                  >
                    {node.person.name}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* ── Controls ── */}
      <div
        style={{ position: 'absolute', bottom: 24, right: 16, zIndex: 40, display: 'flex', flexDirection: 'column', gap: 7 }}
        onMouseDown={e => e.stopPropagation()}
      >
        <Btn onClick={() => zoomAt(containerRef.current!.clientWidth/2, containerRef.current!.clientHeight/2, 1.3)} title="Яқинлаш">+</Btn>
        <Btn onClick={() => zoomAt(containerRef.current!.clientWidth/2, containerRef.current!.clientHeight/2, 1/1.3)} title="Узоқлаш">−</Btn>
        <Divider />
        <Btn onClick={navPrev} title="Олдинги">↑</Btn>
        <Btn onClick={navNext} title="Кейинги">↓</Btn>
        <Divider />
        <Btn onClick={resetView} title="Дастлабки кўриниш" style={{ fontSize: 16 }}>⌂</Btn>
      </div>

      {/* ── Generation dots ── */}
      {selNode != null && (
        <div
          style={{
            position: 'absolute', top: 76, left: 14, zIndex: 40,
            background: 'rgba(8,4,1,0.82)', border: '1px solid rgba(201,162,39,0.18)',
            borderRadius: 10, padding: '7px 12px',
            backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
            pointerEvents: 'none',
          }}
        >
          <div style={{ fontSize: 9, letterSpacing: '0.15em', color: 'rgba(201,162,39,0.5)', textTransform: 'uppercase', marginBottom: 5 }}>
            Авлод
          </div>
          <div style={{ display: 'flex', gap: 5 }}>
            {Array.from({ length: genCount }).map((_, i) => (
              <div
                key={i}
                style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: selNode.generation === i ? GOLD : 'rgba(201,162,39,0.18)',
                  boxShadow: selNode.generation === i ? `0 0 6px ${GOLD}` : 'none',
                  transition: 'all 0.2s',
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Nav counter ── */}
      {navIdx >= 0 && (
        <div
          style={{
            position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)',
            zIndex: 40, pointerEvents: 'none',
            background: 'rgba(8,4,1,0.82)', border: '1px solid rgba(201,162,39,0.18)',
            borderRadius: 999, padding: '5px 16px',
            color: 'rgba(201,162,39,0.7)', fontSize: 11, letterSpacing: '0.05em',
            backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
            whiteSpace: 'nowrap',
          }}
        >
          {navIdx + 1} / {traversal.length}
        </div>
      )}
    </div>
  );
}

// ── Shared UI atoms ─────────────────────────────────────────────────────────

function Btn({
  onClick, children, title, style: extra,
}: {
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
  style?: React.CSSProperties;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 40, height: 40,
        background: 'rgba(8,4,1,0.88)',
        border: '1px solid rgba(201,162,39,0.26)',
        borderRadius: 10,
        color: '#C9A227',
        fontSize: 20,
        cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
        touchAction: 'manipulation',
        flexShrink: 0,
        ...extra,
      }}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div style={{ height: 1, background: 'rgba(201,162,39,0.18)', margin: '1px 0' }} />;
}
