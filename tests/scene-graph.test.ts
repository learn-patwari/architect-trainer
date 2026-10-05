import { describe, expect, it } from 'vitest';
import { parseScene, type ExcalidrawElement } from '../shared/scene/excalidraw-graph.ts';

function rect(id: string, x = 0, y = 0, w = 100, h = 60, hasLabel = false): ExcalidrawElement {
  return { id, type: 'rectangle', x, y, width: w, height: h, boundElements: hasLabel ? [{ id: `${id}-t`, type: 'text' }] : null };
}
function text(id: string, containerId: string, value: string, x = 0, y = 0, w = 60, h = 20): ExcalidrawElement {
  return { id, type: 'text', x, y, width: w, height: h, containerId, text: value };
}
function freeText(id: string, value: string, x: number, y: number, w = 60, h = 20): ExcalidrawElement {
  return { id, type: 'text', x, y, width: w, height: h, text: value };
}
function arrow(id: string, from: string | null, to: string | null, hasLabel = false): ExcalidrawElement {
  return {
    id,
    type: 'arrow',
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    startBinding: from ? { elementId: from } : null,
    endBinding: to ? { elementId: to } : null,
    boundElements: hasLabel ? [{ id: `${id}-t`, type: 'text' }] : null,
  };
}

describe('parseScene', () => {
  it('extracts a labeled node from bound text and infers its role', () => {
    const g = parseScene([rect('n1', 0, 0, 100, 60, true), text('n1-t', 'n1', 'Load Balancer')]);
    expect(g.nodes).toHaveLength(1);
    expect(g.nodes[0]!.label).toBe('Load Balancer');
    expect(g.nodes[0]!.roles).toContain('loadBalancer');
  });

  it('extracts an edge only when both ends are bound', () => {
    const els = [
      rect('n1', 0, 0, 100, 60, true),
      text('n1-t', 'n1', 'Client'),
      rect('n2', 200, 0, 100, 60, true),
      text('n2-t', 'n2', 'Load Balancer'),
      arrow('a1', 'n1', 'n2'),
      arrow('a2', 'n2', null), // dangling
    ];
    const g = parseScene(els);
    expect(g.edges).toHaveLength(1);
    expect(g.edges[0]).toMatchObject({ from: 'n1', to: 'n2' });
  });

  it('labels an edge from its own bound text', () => {
    const els = [
      rect('n1', 0, 0, 100, 60, true),
      text('n1-t', 'n1', 'App'),
      rect('n2', 200, 0, 100, 60, true),
      text('n2-t', 'n2', 'Cache'),
      arrow('a1', 'n1', 'n2', true),
      text('a1-t', 'a1', 'read'),
    ];
    const g = parseScene(els);
    expect(g.edges[0]!.label).toBe('read');
  });

  it('leaves a shape with no label unlabeled and role-less', () => {
    const g = parseScene([rect('n1', 0, 0, 100, 60)]);
    expect(g.nodes[0]!.label).toBe('');
    expect(g.nodes[0]!.roles).toEqual([]);
  });

  it('falls back to an overlapping free-standing text element when nothing is formally bound', () => {
    const g = parseScene([rect('n1', 0, 0, 100, 60), freeText('t1', 'Datastore', 20, 20)]);
    expect(g.nodes[0]!.label).toBe('Datastore');
    expect(g.nodes[0]!.roles).toContain('datastore');
  });

  it('ignores deleted elements', () => {
    const g = parseScene([{ ...rect('n1', 0, 0, 100, 60, true), isDeleted: true }, text('n1-t', 'n1', 'Cache')]);
    expect(g.nodes).toHaveLength(0);
  });

  it('infers the role from a label that wraps onto multiple lines inside a narrow box', () => {
    // Excalidraw wraps "Load Balancer" to "Load\nBalancer" the moment the box is narrower
    // than the text — the role keyword ("load balancer") must still match across that break.
    const g = parseScene([rect('n1', 0, 0, 80, 60, true), text('n1-t', 'n1', 'Load\nBalancer')]);
    expect(g.nodes[0]!.roles).toContain('loadBalancer');
  });

  it('infers LLD roles from class-diagram labels (interface, abstract class, enum)', () => {
    const g = parseScene([
      rect('a', 0, 0, 100, 60, true), text('a-t', 'a', 'Vehicle Interface'),
      rect('b', 200, 0, 100, 60, true), text('b-t', 'b', 'Abstract Shape'),
      rect('c', 400, 0, 100, 60, true), text('c-t', 'c', 'SpotType Enum'),
    ]);
    expect(g.nodes[0]!.roles).toContain('interface');
    expect(g.nodes[1]!.roles).toContain('abstractClass');
    expect(g.nodes[2]!.roles).toContain('enumType');
  });

  it('collects every distinct piece of text into allText', () => {
    const g = parseScene([rect('n1', 0, 0, 100, 60, true), text('n1-t', 'n1', 'API Server'), freeText('note', 'IDs: base62 counter', 0, 200)]);
    expect(g.allText).toContain('API Server');
    expect(g.allText).toContain('IDs: base62 counter');
  });
});
