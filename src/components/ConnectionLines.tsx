import { useMemo } from 'react';
import { Line } from '@react-three/drei';
import * as THREE from 'three';
import type { Connection } from '../lib/types';
import { NODE_RADIUS, V_SPACING } from '../lib/treeLayout';

interface Props {
  connections: Connection[];
}

const BRANCH_ARM = (V_SPACING - NODE_RADIUS * 2) * 0.38;

function branchPoints(
  from: [number, number, number],
  to: [number, number, number],
): [number, number, number][] {
  // Offset to circle edges
  const start = new THREE.Vector3(from[0], from[1] - NODE_RADIUS, 0);
  const end   = new THREE.Vector3(to[0],   to[1]   + NODE_RADIUS, 0);

  // Control points: leave/arrive vertically then curve
  const cp1 = new THREE.Vector3(start.x, start.y - BRANCH_ARM, 0);
  const cp2 = new THREE.Vector3(end.x,   end.y   + BRANCH_ARM, 0);

  const curve = new THREE.CubicBezierCurve3(start, cp1, cp2, end);
  return curve.getPoints(28).map(p => [p.x, p.y, p.z] as [number, number, number]);
}

export function ConnectionLines({ connections }: Props) {
  const lines = useMemo(
    () => connections.map(c => ({ key: c.id, pts: branchPoints(c.fromPos, c.toPos) })),
    [connections],
  );

  return (
    <>
      {lines.map(l => (
        <Line
          key={l.key}
          points={l.pts}
          color="#C9A227"
          lineWidth={1.6}
          transparent
          opacity={0.58}
        />
      ))}
    </>
  );
}
