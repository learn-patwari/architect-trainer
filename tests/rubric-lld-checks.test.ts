import { describe, expect, it } from 'vitest';
import { edgeLabelMatches, hasDominantNode, implementorCount, nodesWithoutRoles } from '../shared/rubric/checks.ts';
import type { SceneGraph } from '../shared/scene/types.ts';

function node(id: string, label: string, roles: SceneGraph['nodes'][number]['roles'] = []): SceneGraph['nodes'][number] {
  return { id, label, roles, x: 0, y: 0, width: 100, height: 60 };
}
function edge(from: string, to: string, label: string | null = null): SceneGraph['edges'][number] {
  return { id: `${from}-${to}`, from, to, label };
}
function graph(nodes: SceneGraph['nodes'], edges: SceneGraph['edges'] = []): SceneGraph {
  return { nodes, edges, allText: nodes.map((n) => n.label) };
}

describe('nodesWithoutRoles', () => {
  it('returns every node not carrying one of the excluded roles', () => {
    const g = graph([node('a', 'Vehicle', ['interface']), node('b', 'Car', []), node('c', 'SpotType', ['enumType'])]);
    const result = nodesWithoutRoles(g, ['interface', 'enumType']);
    expect(result.map((n) => n.id)).toEqual(['b']);
  });
});

describe('implementorCount', () => {
  it('counts distinct nodes with an edge into an abstraction node', () => {
    const g = graph(
      [node('iface', 'Vehicle', ['interface']), node('car', 'Car'), node('moto', 'Motorcycle')],
      [edge('car', 'iface'), edge('moto', 'iface')],
    );
    expect(implementorCount(g, ['interface', 'abstractClass'])).toBe(2);
  });

  it('does not count an edge between two abstraction nodes, or the abstraction pointing at itself', () => {
    const g = graph([node('a', 'A', ['interface']), node('b', 'B', ['interface'])], [edge('a', 'b')]);
    expect(implementorCount(g, ['interface', 'abstractClass'])).toBe(0);
  });

  it('is zero when nothing points at the abstraction', () => {
    const g = graph([node('iface', 'Vehicle', ['interface']), node('car', 'Car')]);
    expect(implementorCount(g, ['interface', 'abstractClass'])).toBe(0);
  });
});

describe('hasDominantNode', () => {
  it('is false below the minimum node count regardless of shape', () => {
    const g = graph([node('a', 'A'), node('b', 'B')], [edge('a', 'b'), edge('a', 'b')]);
    expect(hasDominantNode(g)).toBe(false);
  });

  it('is false when relationships are reasonably distributed', () => {
    const g = graph(
      [node('lot', 'ParkingLot'), node('car', 'Car'), node('moto', 'Motorcycle'), node('iface', 'Vehicle')],
      [edge('car', 'iface'), edge('moto', 'iface'), edge('lot', 'car')],
    );
    expect(hasDominantNode(g)).toBe(false);
  });

  it('is true when one class touches most of the relationships in the diagram (a god class)', () => {
    const g = graph(
      [node('god', 'DoEverything'), node('a', 'A'), node('b', 'B'), node('c', 'C'), node('d', 'D')],
      [edge('god', 'a'), edge('god', 'b'), edge('god', 'c'), edge('god', 'd')],
    );
    expect(hasDominantNode(g)).toBe(true);
  });
});

describe('edgeLabelMatches', () => {
  it('matches a keyword in an edge label, case-insensitively', () => {
    const g = graph([node('a', 'A'), node('b', 'B')], [edge('a', 'b', 'Implements')]);
    expect(edgeLabelMatches(g, ['implements', 'extends'])).toBe(true);
  });

  it('is false when no edge carries a label at all', () => {
    const g = graph([node('a', 'A'), node('b', 'B')], [edge('a', 'b', null)]);
    expect(edgeLabelMatches(g, ['implements', 'extends'])).toBe(false);
  });

  it('does not match a node label, only an edge label', () => {
    const g = graph([node('a', 'Implements'), node('b', 'B')], [edge('a', 'b', null)]);
    expect(edgeLabelMatches(g, ['implements'])).toBe(false);
  });
});
