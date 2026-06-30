import type { RawFamilyData, Person, LayoutNode, Connection, TreeData } from './types';

const H_SPACING = 2.6;
const V_SPACING = 3.8;
const NODE_W = 2.2;
const NODE_H = 1.1;

function parsePersons(raw: RawFamilyData): Map<string, Person> {
  const map = new Map<string, Person>();
  for (const [id, p] of Object.entries(raw.p)) {
    map.set(id, {
      id,
      name: p.n,
      sex: p.s,
      children: p.c.filter(c => raw.p[c]),
      spouses: p.sp.filter(s => raw.p[s]),
    });
  }
  return map;
}

// Compute subtree leaf count (used for horizontal spread)
function leafCount(id: string, persons: Map<string, Person>, visited: Set<string>): number {
  if (visited.has(id)) return 1;
  visited.add(id);
  const p = persons.get(id);
  if (!p || p.children.length === 0) return 1;
  return p.children.reduce((s, c) => s + leafCount(c, persons, new Set(visited)), 0);
}

interface PosMap {
  [id: string]: { x: number; y: number; gen: number };
}

function assignPositions(
  id: string,
  persons: Map<string, Person>,
  gen: number,
  xCenter: number,
  result: PosMap,
  visited: Set<string>
): number {
  if (visited.has(id)) return 1;
  visited.add(id);

  const p = persons.get(id);
  if (!p) return 1;

  const children = p.children;
  if (children.length === 0) {
    result[id] = { x: xCenter, y: -gen * V_SPACING, gen };
    return 1;
  }

  const childLeaves = children.map(c => leafCount(c, persons, new Set(visited)));
  const totalLeaves = childLeaves.reduce((a, b) => a + b, 0);
  const totalWidth = totalLeaves * H_SPACING;

  let currentX = xCenter - totalWidth / 2;
  children.forEach((childId, i) => {
    const childWidth = childLeaves[i] * H_SPACING;
    const childCenter = currentX + childWidth / 2;
    assignPositions(childId, persons, gen + 1, childCenter, result, new Set(visited));
    currentX += childWidth;
  });

  result[id] = { x: xCenter, y: -gen * V_SPACING, gen };
  return totalLeaves;
}

export function buildTreeData(raw: RawFamilyData): TreeData {
  const personMap = parsePersons(raw);
  const posMap: PosMap = {};
  const visited = new Set<string>();

  assignPositions(raw.root, personMap, 0, 0, posMap, visited);

  const nodes: LayoutNode[] = [];
  const connections: Connection[] = [];
  const connectionSet = new Set<string>();

  // Build nodes
  for (const [id, pos] of Object.entries(posMap)) {
    const person = personMap.get(id);
    if (!person) continue;
    nodes.push({
      id,
      person,
      position: [pos.x, pos.y, 0],
      generation: pos.gen,
      parentId: null,
      subtreeWidth: 1,
    });
  }

  // Build connections (parent → child)
  for (const node of nodes) {
    const person = node.person;
    for (const childId of person.children) {
      const childPos = posMap[childId];
      if (!childPos) continue;
      const connKey = `${node.id}-${childId}`;
      if (connectionSet.has(connKey)) continue;
      connectionSet.add(connKey);

      connections.push({
        id: connKey,
        fromId: node.id,
        toId: childId,
        fromPos: [posMap[node.id].x, posMap[node.id].y, 0],
        toPos: [childPos.x, childPos.y, 0],
      });
    }
  }

  return { nodes, connections, personMap };
}

export const NODE_RADIUS = 0.75;
export const ROOT_RADIUS = 1.05;
export { NODE_W, NODE_H, V_SPACING };
