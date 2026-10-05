import type { Role, SceneGraph, SceneNode } from '../scene/types.ts';

/**
 * Reusable, composable primitives over a SceneGraph. Built once here so every
 * future problem's RubricSpec is content authoring, not re-implementing graph
 * reasoning.
 */

export function nodesWithRole(graph: SceneGraph, role: Role): SceneNode[] {
  return graph.nodes.filter((n) => n.roles.includes(role));
}

export function hasRole(graph: SceneGraph, role: Role): boolean {
  return nodesWithRole(graph, role).length > 0;
}

function adjacency(graph: SceneGraph): Map<string, string[]> {
  const adj = new Map<string, string[]>();
  for (const e of graph.edges) {
    if (!adj.has(e.from)) adj.set(e.from, []);
    adj.get(e.from)!.push(e.to);
  }
  return adj;
}

function reaches(adj: Map<string, string[]>, start: string, targets: Set<string>): boolean {
  if (targets.has(start)) return true;
  const seen = new Set([start]);
  const stack = [start];
  while (stack.length > 0) {
    const cur = stack.pop()!;
    for (const next of adj.get(cur) ?? []) {
      if (targets.has(next)) return true;
      if (!seen.has(next)) {
        seen.add(next);
        stack.push(next);
      }
    }
  }
  return false;
}

/** Is there a directed path (any number of hops) from a node with `from` role to a node with `to` role? */
export function pathExists(graph: SceneGraph, from: Role, to: Role): boolean {
  const starts = nodesWithRole(graph, from);
  const targets = new Set(nodesWithRole(graph, to).map((n) => n.id));
  if (starts.length === 0 || targets.size === 0) return false;
  const adj = adjacency(graph);
  return starts.some((s) => reaches(adj, s.id, targets));
}

export function allNodesLabeled(graph: SceneGraph): { labeled: number; total: number } {
  const total = graph.nodes.length;
  const labeled = graph.nodes.filter((n) => n.label.trim().length > 0).length;
  return { labeled, total };
}

/** A label wraps onto multiple lines the moment it's longer than its box — collapse whitespace
 *  so a keyword match doesn't get split apart by a line break the shape's width forced in. */
export function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ');
}

const REDUNDANCY_KEYWORDS = [
  'replica', 'cluster', 'multi-az', 'standby', 'x2', 'x3', ' x 2', ' x 3',
  'primary/secondary', 'leader/follower', 'multiple instances', 'horizontally scaled',
];

/** True when a role has >=2 distinct nodes, or a node in that role names redundancy explicitly. */
export function redundancyEvidence(graph: SceneGraph, role: Role): boolean {
  const nodes = nodesWithRole(graph, role);
  if (nodes.length >= 2) return true;
  return nodes.some((n) => REDUNDANCY_KEYWORDS.some((k) => normalize(n.label).includes(k)));
}

/** Does any text anywhere in the scene mention one of these keywords? Case-insensitive substring match. */
export function keywordAnywhere(graph: SceneGraph, keywords: string[]): boolean {
  const hay = normalize(graph.allText.join(' \n '));
  return keywords.some((k) => hay.includes(normalize(k)));
}

// ---------------------------------------------------------------- LLD / class-design primitives

/** Every node NOT carrying one of the given roles — e.g. "concrete classes" as everything that isn't
 *  tagged interface/abstract/enum, without needing a stored 'concreteClass' role at all. */
export function nodesWithoutRoles(graph: SceneGraph, excluded: Role[]): SceneNode[] {
  return graph.nodes.filter((n) => !n.roles.some((r) => excluded.includes(r)));
}

/** How many distinct nodes outside `abstractionRoles` have an edge INTO a node carrying one of those
 *  roles — evidence an abstraction is actually implemented/extended, not just drawn with nothing using it. */
export function implementorCount(graph: SceneGraph, abstractionRoles: Role[]): number {
  const abstractionIds = new Set(graph.nodes.filter((n) => n.roles.some((r) => abstractionRoles.includes(r))).map((n) => n.id));
  const implementors = new Set<string>();
  for (const e of graph.edges) {
    if (abstractionIds.has(e.to) && !abstractionIds.has(e.from)) implementors.add(e.from);
  }
  return implementors.size;
}

/** A structural proxy for a "god class": true when one node accounts for a disproportionate share
 *  of all edge endpoints in the graph. Only fires on graphs big enough for the ratio to mean anything.
 *
 *  Note on the default ratio: in a simple graph (no self-loops or duplicate edges), the busiest node
 *  in a pure star topology accounts for exactly half of all edge-touch-counts (handshake lemma) —
 *  that's the practical MAXIMUM a single class can reach by pointing at every other class once. So
 *  0.5 is deliberately an inclusive floor (>=), not a strict one: "touches half of everything" is
 *  already the star-shaped, do-everything class this check exists to catch. */
export function hasDominantNode(graph: SceneGraph, opts: { minNodes?: number; ratio?: number } = {}): boolean {
  const minNodes = opts.minNodes ?? 4;
  const ratio = opts.ratio ?? 0.5;
  if (graph.nodes.length < minNodes) return false;
  const degreeOf = (id: string) => graph.edges.filter((e) => e.to === id || e.from === id).length;
  const degrees = graph.nodes.map((n) => degreeOf(n.id));
  const total = degrees.reduce((a, b) => a + b, 0);
  if (total === 0) return false;
  return degrees.some((d) => d / total >= ratio);
}

/** Does any EDGE's own label (not a node label) mention one of these relationship keywords? */
export function edgeLabelMatches(graph: SceneGraph, keywords: string[]): boolean {
  return graph.edges.some((e) => e.label != null && keywords.some((k) => normalize(e.label!).includes(normalize(k))));
}
