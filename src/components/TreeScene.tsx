import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { MapControls, Stars } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { PersonNode } from './PersonNode';
import { ConnectionLines } from './ConnectionLines';
import { ParticleField } from './ParticleField';
import { ROOT_RADIUS } from '../lib/treeLayout';
import type { TreeData, Person } from '../lib/types';

function zoomCamera(ctrl: any, factor: number) {
  const cam: THREE.PerspectiveCamera = ctrl.object;
  const target: THREE.Vector3 = ctrl.target.clone();
  const dir = cam.position.clone().sub(target);
  const newLen = THREE.MathUtils.clamp(dir.length() * factor, ctrl.minDistance, ctrl.maxDistance);
  dir.setLength(newLen);
  cam.position.copy(target.add(dir));
  ctrl.update();
}

function CameraSetup({ treeData }: { treeData: TreeData }) {
  const { camera } = useThree();
  const didInit = useRef(false);

  useEffect(() => {
    if (didInit.current || treeData.nodes.length === 0) return;
    didInit.current = true;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const n of treeData.nodes) {
      minX = Math.min(minX, n.position[0]);
      maxX = Math.max(maxX, n.position[0]);
      minY = Math.min(minY, n.position[1]);
      maxY = Math.max(maxY, n.position[1]);
    }

    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const width  = maxX - minX + 8;
    const height = maxY - minY + 8;

    const perspCam = camera as THREE.PerspectiveCamera;
    const fov    = perspCam.fov * (Math.PI / 180);
    const aspect = perspCam.aspect;
    const zH = (height / 2) / Math.tan(fov / 2);
    const zW = (width / 2) / (aspect * Math.tan(fov / 2));
    const z  = Math.max(zH, zW) * 1.25;

    camera.position.set(cx, cy, z);
    camera.lookAt(cx, cy, 0);
  }, [camera, treeData]);

  return null;
}

// Hide labels when camera is further away than this Z distance.
// At this zoom level individual nodes are too small for readable text,
// so we remove all 153 Html DOM overlays for a significant perf gain.
const LABEL_SHOW_THRESHOLD = 130;

// Inner component (inside Canvas) that watches camera Z and notifies parent
// only when the label-visibility threshold is crossed — never every frame.
function LabelLOD({ onChange }: { onChange: (visible: boolean) => void }) {
  const prev = useRef(true);
  useFrame(({ camera }) => {
    const visible = camera.position.z < LABEL_SHOW_THRESHOLD;
    if (visible !== prev.current) {
      prev.current = visible;
      onChange(visible);
    }
  });
  return null;
}

interface SceneContentProps {
  treeData: TreeData;
  selectedId: string | null;
  onSelect: (id: string) => void;
  rootId: string;
  controlsRef: React.MutableRefObject<any>;
}

function SceneContent({ treeData, selectedId, onSelect, rootId, controlsRef }: SceneContentProps) {
  const [showLabels, setShowLabels] = useState(true);
  const rootNode = useMemo(() => treeData.nodes.find(n => n.id === rootId), [treeData.nodes, rootId]);

  return (
    <>
      <CameraSetup treeData={treeData} />
      <LabelLOD onChange={setShowLabels} />

      <ambientLight intensity={0.28} color="#3A2400" />
      <pointLight position={[0, 10, 18]}  intensity={1.6} color="#C9A227" decay={2} />
      <pointLight position={[-55, -5, 10]} intensity={0.55} color="#5B3A00" decay={2} />
      <pointLight position={[ 55, -5, 10]} intensity={0.55} color="#5B3A00" decay={2} />
      <pointLight position={[0, -30, 8]}   intensity={0.35} color="#200F00" decay={2} />

      <Stars radius={200} depth={60} count={2500} factor={3} fade speed={0.2} />
      <ParticleField />

      {/* Tree trunk below root */}
      {rootNode && (
        <>
          <mesh position={[rootNode.position[0], rootNode.position[1] - ROOT_RADIUS - 0.55, -0.2]}>
            <planeGeometry args={[0.18, 1.1]} />
            <meshStandardMaterial color="#3D2000" emissive="#1A0900" emissiveIntensity={0.25} roughness={0.95} />
          </mesh>
          {/* Trunk base flare */}
          <mesh position={[rootNode.position[0], rootNode.position[1] - ROOT_RADIUS - 1.15, -0.2]}>
            <planeGeometry args={[0.32, 0.18]} />
            <meshStandardMaterial color="#2A1600" emissive="#120800" emissiveIntensity={0.2} roughness={0.95} />
          </mesh>
        </>
      )}

      <ConnectionLines connections={treeData.connections} />

      {treeData.nodes.map(node => (
        <PersonNode
          key={node.id}
          node={node}
          isRoot={node.id === rootId}
          isSelected={node.id === selectedId}
          onSelect={onSelect}
          showLabel={showLabels}
        />
      ))}

      <EffectComposer>
        <Bloom intensity={1.15} luminanceThreshold={0.2} luminanceSmoothing={0.75} mipmapBlur />
      </EffectComposer>

      {/* MapControls: left-click / one-finger swipe = PAN (vs OrbitControls
          which maps one finger to rotate). Right-click = rotate (disabled).
          This makes touch navigation feel natural — swipe to explore the tree. */}
      <MapControls
        ref={controlsRef}
        enableRotate={false}
        enablePan
        screenSpacePanning
        enableDamping
        dampingFactor={0.18}
        minDistance={5}
        maxDistance={420}
        makeDefault
      />
    </>
  );
}

function ZoomButtons({ onZoomIn, onZoomOut }: { onZoomIn: () => void; onZoomOut: () => void }) {
  const base: React.CSSProperties = {
    width: 48,
    height: 48,
    borderRadius: 14,
    background: 'rgba(10,5,1,0.88)',
    border: '1px solid rgba(201,162,39,0.42)',
    color: '#C9A227',
    fontSize: 26,
    fontWeight: 300,
    lineHeight: 1,
    cursor: 'pointer',
    backdropFilter: 'blur(14px)',
    WebkitBackdropFilter: 'blur(14px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    WebkitTapHighlightColor: 'transparent',
    touchAction: 'manipulation',
    transition: 'border-color 0.15s, background 0.15s',
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 32,
        right: 20,
        zIndex: 60,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <button onClick={onZoomIn} style={base} aria-label="Яқинлаштириш">
        +
      </button>
      <button onClick={onZoomOut} style={base} aria-label="Узоқлаштириш">
        −
      </button>
    </div>
  );
}

interface Props {
  treeData: TreeData;
  rootId: string;
  onSelectPerson: (person: Person | null) => void;
}

export function TreeScene({ treeData, rootId, onSelectPerson }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const controlsRef = useRef<any>(null);

  const handleSelect = (id: string) => {
    const next = id === selectedId ? null : id;
    setSelectedId(next);
    onSelectPerson(next ? (treeData.personMap.get(next) ?? null) : null);
  };

  const handleZoomIn  = useCallback(() => { if (controlsRef.current) zoomCamera(controlsRef.current, 0.68); }, []);
  const handleZoomOut = useCallback(() => { if (controlsRef.current) zoomCamera(controlsRef.current, 1.47); }, []);

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <Canvas
        camera={{ fov: 45, near: 0.1, far: 1500 }}
        dpr={[1, 2]}
        performance={{ min: 0.5 }}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.1,
        }}
        onPointerMissed={() => { setSelectedId(null); onSelectPerson(null); }}
        style={{ width: '100%', height: '100%' }}
      >
        <color attach="background" args={['#080401']} />

        <Suspense fallback={null}>
          <SceneContent
            treeData={treeData}
            selectedId={selectedId}
            onSelect={handleSelect}
            rootId={rootId}
            controlsRef={controlsRef}
          />
        </Suspense>
      </Canvas>

      <ZoomButtons onZoomIn={handleZoomIn} onZoomOut={handleZoomOut} />
    </div>
  );
}
