import { describe, expect, it } from 'vitest';
import { describeScene } from '../shared/scene/describe.ts';
import type { SceneGraph } from '../shared/scene/types.ts';

describe('describeScene', () => {
  it('renders a multi-line label (wrapped by its box) as one line of prose', () => {
    const graph: SceneGraph = {
      nodes: [{ id: 'n1', label: 'Load\nBalancer', roles: ['loadBalancer'], x: 0, y: 0, width: 80, height: 40 }],
      edges: [],
      allText: ['Load\nBalancer'],
    };
    const text = describeScene(graph);
    expect(text).toContain('Load Balancer [loadBalancer]');
    expect(text).not.toContain('Load\nBalancer');
  });

  it('reports nothing drawn on an empty graph', () => {
    expect(describeScene({ nodes: [], edges: [], allText: [] })).toBe('(Nothing drawn.)');
  });

  it('lists connections by node label, including a multi-word edge label', () => {
    const graph: SceneGraph = {
      nodes: [
        { id: 'a', label: 'API Server', roles: ['appServer'], x: 0, y: 0, width: 80, height: 40 },
        { id: 'b', label: 'Redis Cache', roles: ['cache'], x: 0, y: 0, width: 80, height: 40 },
      ],
      edges: [{ id: 'e1', from: 'a', to: 'b', label: 'read' }],
      allText: [],
    };
    expect(describeScene(graph)).toContain('API Server -> Redis Cache (read)');
  });
});
