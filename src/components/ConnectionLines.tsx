import { memo, useMemo, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Connection } from '../lib/types';
import { NODE_RADIUS, V_SPACING } from '../lib/treeLayout';

const BRANCH_ARM    = (V_SPACING - NODE_RADIUS * 2) * 0.38;
const CURVE_SEGS    = 28;               // segments passed to getPoints()
const TOTAL_VERTS   = CURVE_SEGS + 1;  // 29 actual vertices
const GEN_DELAY     = 0.38;            // seconds of stagger per generation depth
const DRAW_DURATION = 0.52;            // seconds to fully reveal one branch

// Single shared material — one GPU allocation for all lines.
// Opacity slightly higher than original (0.58) to compensate for 1 px width
// (bloom post-processing adds visible glow regardless).
const lineMaterial = new THREE.LineBasicMaterial({
  color: 0xC9A227,
  transparent: true,
  opacity: 0.72,
});

interface BranchEntry {
  line: THREE.Line;
  geo:  THREE.BufferGeometry;
  delay: number;
}

function buildBranches(connections: Connection[], skipAnim: boolean): BranchEntry[] {
  return connections.map(conn => {
    const start = new THREE.Vector3(conn.fromPos[0], conn.fromPos[1] - NODE_RADIUS, 0);
    const end   = new THREE.Vector3(conn.toPos[0],   conn.toPos[1]   + NODE_RADIUS, 0);

    // Leave/arrive vertically, then S-curve to the child
    const cp1 = new THREE.Vector3(start.x, start.y - BRANCH_ARM, 0);
    const cp2 = new THREE.Vector3(end.x,   end.y   + BRANCH_ARM, 0);

    const pts = new THREE.CubicBezierCurve3(start, cp1, cp2, end).getPoints(CURVE_SEGS);
    const geo = new THREE.BufferGeometry().setFromPoints(pts);

    // Animation direction:
    //   • Points 0→N naturally go from parent (top) toward child (bottom/sides).
    //   • Siblings whose child.x ≠ parent.x will appear to "wipe to the side"
    //     as mid-curve points spread horizontally after the initial downward drop.
    //   • drawRange(0, n) reveals the first n vertices — top-to-bottom for a
    //     straight branch, top-then-sideways for lateral ones.
    geo.setDrawRange(0, skipAnim ? TOTAL_VERTS : 0);

    const line = new THREE.Line(geo, lineMaterial);
    line.frustumCulled = false;

    // Stagger by generation so the tree "grows" level by level.
    // fromPos[1] = -generation * V_SPACING  →  generation = -fromPos[1] / V_SPACING
    const generation = Math.round(-conn.fromPos[1] / V_SPACING);
    return { line, geo, delay: generation * GEN_DELAY };
  });
}

interface Props {
  connections: Connection[];
}

export const ConnectionLines = memo(function ConnectionLines({ connections }: Props) {
  const groupRef  = useRef<THREE.Group>(null!);
  const mountedAt = useRef(-1);          // clock time at first useFrame tick

  const skipAnim = useMemo(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  );

  const branches = useMemo(
    () => buildBranches(connections, skipAnim),
    [connections, skipAnim],
  );

  // Attach/detach THREE.Line objects directly — no React state involved,
  // so animation never triggers a re-render.
  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    branches.forEach(b => group.add(b.line));
    return () => {
      branches.forEach(b => {
        group.remove(b.line);
        b.geo.dispose();
      });
    };
  }, [branches]);

  useFrame(({ clock }) => {
    if (skipAnim) return;

    // Record the clock time on first invocation so the animation always starts
    // from zero relative to mount time, regardless of canvas uptime.
    if (mountedAt.current < 0) mountedAt.current = clock.elapsedTime;
    const t = clock.elapsedTime - mountedAt.current;

    for (const { geo, delay } of branches) {
      const p = Math.min(1, Math.max(0, (t - delay) / DRAW_DURATION));
      // p=0 → invisible; p=1 → all TOTAL_VERTS drawn
      geo.setDrawRange(0, p > 0 ? Math.ceil(p * TOTAL_VERTS) : 0);
    }
  });

  return <group ref={groupRef} />;
});
