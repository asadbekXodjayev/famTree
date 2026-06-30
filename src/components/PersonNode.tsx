import { useRef, useState, useCallback } from 'react';
import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { LayoutNode } from '../lib/types';
import { NODE_RADIUS, ROOT_RADIUS } from '../lib/treeLayout';

const GOLD        = '#C9A227';
const GOLD_BRIGHT = '#F2D478';
const GOLD_DIM    = '#6B4E10';
const DARK_BG     = '#0D0701';
const ROOT_BG     = '#1C0D02';
const MALE        = '#5B8DD9';
const FEMALE      = '#D4826A';
const CREAM       = '#F6F1E9';

interface Props {
  node: LayoutNode;
  isRoot: boolean;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

export function PersonNode({ node, isRoot, isSelected, onSelect }: Props) {
  const ringRef  = useRef<THREE.Mesh>(null!);
  const glowRef  = useRef<THREE.Mesh>(null!);
  const groupRef = useRef<THREE.Group>(null!);
  const [hovered, setHovered] = useState(false);

  const r          = isRoot ? ROOT_RADIUS : NODE_RADIUS;
  const accentColor = node.person.sex === 1 ? MALE : FEMALE;
  const ringColor   = isRoot ? GOLD_BRIGHT : isSelected ? GOLD_BRIGHT : hovered ? GOLD : GOLD_DIM;

  useFrame((state) => {
    if (!ringRef.current) return;

    if (isRoot && groupRef.current) {
      groupRef.current.position.z = Math.sin(state.clock.elapsedTime * 0.85) * 0.07;
    }

    const rMat = ringRef.current.material as THREE.MeshStandardMaterial;
    const targetE = isSelected ? 1.4 : hovered ? 0.9 : isRoot ? 0.7 : 0.28;
    rMat.emissiveIntensity = THREE.MathUtils.lerp(rMat.emissiveIntensity, targetE, 0.12);

    if (glowRef.current) {
      const gMat = glowRef.current.material as THREE.MeshStandardMaterial;
      const pulse = isRoot ? 0.09 + Math.sin(state.clock.elapsedTime * 1.1) * 0.04 : 0;
      const targetO = isSelected ? 0.22 : hovered ? 0.1 : pulse;
      gMat.opacity = THREE.MathUtils.lerp(gMat.opacity, targetO, 0.1);
    }
  });

  const handleClick = useCallback(
    (e: { stopPropagation: () => void }) => { e.stopPropagation(); onSelect(node.id); },
    [node.id, onSelect],
  );

  const shortName = node.person.name.length > 11
    ? node.person.name.slice(0, 10) + '…'
    : node.person.name;

  return (
    <group
      ref={groupRef}
      position={node.position}
      onClick={handleClick}
      onPointerEnter={() => { setHovered(true);  document.body.style.cursor = 'pointer'; }}
      onPointerLeave={() => { setHovered(false); document.body.style.cursor = 'default'; }}
    >
      {/* Ambient glow halo */}
      <mesh ref={glowRef}>
        <circleGeometry args={[r + 0.32, 48]} />
        <meshStandardMaterial
          color={GOLD_BRIGHT}
          emissive={GOLD_BRIGHT}
          emissiveIntensity={0.25}
          transparent
          opacity={0}
          depthWrite={false}
        />
      </mesh>

      {/* Gold border ring */}
      <mesh ref={ringRef}>
        <ringGeometry args={[r * 0.87, r, 64]} />
        <meshStandardMaterial
          color={ringColor}
          emissive={ringColor}
          emissiveIntensity={isRoot ? 0.7 : 0.28}
          roughness={0.12}
          metalness={0.92}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Inner dark fill */}
      <mesh position={[0, 0, -0.01]}>
        <circleGeometry args={[r * 0.86, 64]} />
        <meshStandardMaterial
          color={isRoot ? ROOT_BG : DARK_BG}
          roughness={0.88}
          metalness={0.08}
        />
      </mesh>

      {/* Sex accent dot at top */}
      <mesh position={[0, r * 0.58, 0.02]}>
        <circleGeometry args={[0.09, 16]} />
        <meshStandardMaterial
          color={accentColor}
          emissive={accentColor}
          emissiveIntensity={0.9}
        />
      </mesh>

      {/* Inner ring detail for root */}
      {isRoot && (
        <mesh position={[0, 0, 0.01]}>
          <ringGeometry args={[r * 0.48, r * 0.5, 64]} />
          <meshStandardMaterial
            color={GOLD_BRIGHT}
            emissive={GOLD_BRIGHT}
            emissiveIntensity={0.3}
            transparent
            opacity={0.4}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {/* Name label */}
      <Html
        center
        position={[0, isRoot ? -0.06 : -0.04, 0.06]}
        distanceFactor={10}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
        zIndexRange={[1, 2]}
      >
        <div style={{ textAlign: 'center', fontFamily: "'Georgia', serif" }}>
          <div
            style={{
              fontSize: isRoot ? 15 : 9,
              fontWeight: isRoot ? 700 : 400,
              color: isSelected
                ? CREAM
                : isRoot
                  ? GOLD_BRIGHT
                  : hovered
                    ? CREAM
                    : 'rgba(246,241,233,0.82)',
              whiteSpace: 'nowrap',
              textShadow: '0 1px 5px rgba(0,0,0,0.98)',
              letterSpacing: '0.01em',
              lineHeight: 1.2,
            }}
          >
            {isRoot ? node.person.name : shortName}
          </div>
          {isRoot && (
            <div
              style={{
                fontSize: 6,
                color: 'rgba(201,162,39,0.65)',
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                marginTop: 3,
                whiteSpace: 'nowrap',
              }}
            >
              АСОСЧИ
            </div>
          )}
        </div>
      </Html>
    </group>
  );
}
