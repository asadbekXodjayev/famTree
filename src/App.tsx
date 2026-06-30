import { useMemo, useState } from 'react';
import { FAMILY_DATA } from './data/familyData';
import { buildTreeData } from './lib/treeLayout';
import { TreeScene } from './components/TreeScene';
import { InfoPanel } from './components/InfoPanel';
import { HUD } from './components/HUD';
import type { Person } from './lib/types';

export default function App() {
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);

  const treeData = useMemo(() => buildTreeData(FAMILY_DATA), []);

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', background: '#080401' }}>
      <HUD
        totalNodes={treeData.nodes.length}
        selectedName={selectedPerson?.name ?? null}
      />

      <TreeScene
        treeData={treeData}
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
