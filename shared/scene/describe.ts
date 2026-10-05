import type { SceneGraph } from './types.ts';

/** A label a shape's width forced onto multiple lines reads as one line of prose here. */
function oneLine(label: string): string {
  return label.trim().replace(/\s+/g, ' ');
}

/** Plain-text rendering of a scene graph, for the AI review prompt. */
export function describeScene(graph: SceneGraph): string {
  if (graph.nodes.length === 0) return '(Nothing drawn.)';

  const byId = new Map(graph.nodes.map((n) => [n.id, oneLine(n.label) || '(unlabeled)']));
  const lines: string[] = ['Nodes:'];
  for (const n of graph.nodes) {
    const roleStr = n.roles.length ? ` [${n.roles.join(', ')}]` : ' [unrecognized role]';
    lines.push(`- ${oneLine(n.label) || '(unlabeled)'}${roleStr}`);
  }
  lines.push('', 'Connections:');
  if (graph.edges.length === 0) lines.push('(none)');
  for (const e of graph.edges) {
    const label = e.label ? ` (${e.label})` : '';
    lines.push(`- ${byId.get(e.from) ?? '?'} -> ${byId.get(e.to) ?? '?'}${label}`);
  }
  return lines.join('\n');
}
