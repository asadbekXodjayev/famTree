export interface RawPerson {
  n: string;
  s: 1 | 2;
  c: string[];
  sp: string[];
}

export interface RawFamilyData {
  root: string;
  p: Record<string, RawPerson>;
}

export interface Person {
  id: string;
  name: string;
  sex: 1 | 2;
  children: string[];
  spouses: string[];
}

export interface LayoutNode {
  id: string;
  person: Person;
  position: [number, number, number];
  generation: number;
  parentId: string | null;
  subtreeWidth: number;
}

export interface Connection {
  id: string;
  fromId: string;
  toId: string;
  fromPos: [number, number, number];
  toPos: [number, number, number];
}

export interface TreeData {
  nodes: LayoutNode[];
  connections: Connection[];
  personMap: Map<string, Person>;
}
