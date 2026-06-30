import { memo, useMemo, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Connection } from '../lib/types';
import { NODE_RADIUS, V_SPACING } from '../lib/treeLayout';

const BRANCH_ARM    = (V_SPACING - NODE_RADIUS * 2) * 0.38;
const CURVE_SEGS    = 28;
const WIPE_DURATION = 2.2;  // seconds for the full curtain to sweep the tree

// Fragment shader: discard anything ABOVE the current wipe line.
// As uWipeY decreases (moves downward in world space), branches are
// revealed from the root toward the leaves — top-to-bottom wipe.
// Siblings that spread sideways become visible together as the curtain
// passes through their shared starting point, producing the "wipe to
// the sides" effect naturally from the Bezier geometry.
const vertexShader = /* glsl */`
  varying float vWorldY;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorldY     = world.y;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const fragmentShader = /* glsl */`
  uniform vec3  uColor;
  uniform float uWipeY;   // sweeps from wipeStart (high Y) down to wipeEnd (low Y)
  uniform float uOpacity;
  varying float vWorldY;
  void main() {
    // Discard fragments that are still ABOVE the wipe curtain
    if (vWorldY > uWipeY) discard;
    gl_FragColor = vec4(uColor, uOpacity);
  }
`;

// Single shared ShaderMaterial — one `uWipeY` uniform update per frame
// controls the reveal for all 150+ branches simultaneously, with zero
// per-branch cost.
const wipeMaterial = new THREE.ShaderMaterial({
  uniforms: {
    uColor:   { value: new THREE.Color(0xC9A227) },
    uWipeY:   { value: -999 },   // will be set on mount
    uOpacity: { value: 0.72 },
  },
  vertexShader,
  fragmentShader,
  transparent: true,
  depthWrite: false,
});

function buildBranches(connections: Connection[]) {
  return connections.map(conn => {
    const start = new THREE.Vector3(conn.fromPos[0], conn.fromPos[1] - NODE_RADIUS, 0);
    const end   = new THREE.Vector3(conn.toPos[0],   conn.toPos[1]   + NODE_RADIUS, 0);
    const cp1   = new THREE.Vector3(start.x, start.y - BRANCH_ARM, 0);
    const cp2   = new THREE.Vector3(end.x,   end.y   + BRANCH_ARM, 0);

    const pts = new THREE.CubicBezierCurve3(start, cp1, cp2, end).getPoints(CURVE_SEGS);
    const geo  = new THREE.BufferGeometry().setFromPoints(pts);
    const line = new THREE.Line(geo, wipeMaterial);
    line.frustumCulled = false;
    return { line, geo };
  });
}

interface Props {
  connections: Connection[];
}

export const ConnectionLines = memo(function ConnectionLines({ connections }: Props) {
  const groupRef  = useRef<THREE.Group>(null!);
  const mountedAt = useRef(-1);
  const animDone  = useRef(false);

  const skipAnim = useMemo(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  );

  // wipeStart: just above the topmost branch vertex (root's outgoing edge at Y ≈ -0.75)
  // wipeEnd:   below the lowest branch endpoint so everything becomes visible
  const { wipeStart, wipeEnd } = useMemo(() => {
    if (connections.length === 0) return { wipeStart: 0, wipeEnd: -10 };
    const deepest = Math.min(...connections.map(c => c.toPos[1]));
    return {
      wipeStart: NODE_RADIUS * 0.5,          // slightly above first branch vertex
      wipeEnd:   deepest - NODE_RADIUS - 1,  // below the lowest branch
    };
  }, [connections]);

  const branches = useMemo(() => buildBranches(connections), [connections]);

  // Initialise the wipe position before the first render
  useEffect(() => {
    mountedAt.current = -1;
    animDone.current  = false;
    wipeMaterial.uniforms.uWipeY.value = skipAnim ? wipeEnd : wipeStart;
  }, [skipAnim, wipeStart, wipeEnd]);

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
    if (skipAnim || animDone.current) return;

    if (mountedAt.current < 0) mountedAt.current = clock.elapsedTime;
    const t = (clock.elapsedTime - mountedAt.current) / WIPE_DURATION;

    if (t >= 1) {
      wipeMaterial.uniforms.uWipeY.value = wipeEnd;
      animDone.current = true;
      return;
    }

    // Cubic ease-out: fast start, gentle settle
    const ease = 1 - Math.pow(1 - t, 3);
    wipeMaterial.uniforms.uWipeY.value = wipeStart + ease * (wipeEnd - wipeStart);
  });

  return <group ref={groupRef} />;
});
