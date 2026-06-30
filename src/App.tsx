import { useMemo, useState } from 'react';
import { FAMILY_DATA } from './data/familyData';
import { buildTreeData } from './lib/treeLayout';
import { TreeCanvas } from './components/TreeCanvas';
import { InfoPanel } from './components/InfoPanel';
import { HUD } from './components/HUD';
import type { Person } from './lib/types';

export default function App() {
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const treeData = useMemo(() => buildTreeData(FAMILY_DATA), []);

  return (
    <div style={{ width: '100vw', height: '100svh', overflow: 'hidden', background: '#080401', position: 'relative' }}>
      <HUD
        totalNodes={treeData.nodes.length}
        selectedName={selectedPerson?.name ?? null}
      />

      <TreeCanvas
        nodes={treeData.nodes}
        connections={treeData.connections}
        rootId={FAMILY_DATA.root}
        onSelectPerson={setSelectedPerson}
      />

      <InfoPanel
        person={selectedPerson}
        personMap={treeData.personMap}
        onClose={() => setSelectedPerson(null)}
      />
    </div>
  );
}
