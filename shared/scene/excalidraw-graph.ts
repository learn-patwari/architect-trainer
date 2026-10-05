import type { Role, SceneEdge, SceneGraph, SceneNode } from './types.ts';

/**
 * Turns an Excalidraw scene into the generic SceneGraph the rubric engine reasons
 * over. Deliberately typed against a minimal structural slice of Excalidraw's own
 * element shape (not the real @excalidraw/excalidraw types) so this module has no
 * dependency on the UI package — it's imported by server/ code that never touches
 * the browser.
 */

export interface ExcalidrawElement {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isDeleted?: boolean;
  /** Set on a text element that's bound inside a container shape. */
  containerId?: string | null;
  text?: string;
  /** Set on a container shape that has a bound text (or, for an arrow, its label). */
  boundElements?: { id: string; type: string }[] | null;
  startBinding?: { elementId: string } | null;
  endBinding?: { elementId: string } | null;
}

const NODE_TYPES = new Set(['rectangle', 'ellipse', 'diamond']);

const ROLE_KEYWORDS: Record<Role, string[]> = {
  client: ['client', 'user', 'browser', 'mobile app', 'mobile client'],
  loadBalancer: ['load balancer', 'load-balancer', ' lb ', ' lb', 'lb ', 'elb', 'alb', 'nginx', 'envoy', 'haproxy'],
  appServer: ['app server', 'api server', 'application server', 'app tier', 'backend', 'web server', 'service', 'gateway', 'websocket'],
  cache: ['cache', 'redis', 'memcached'],
  queue: ['queue', 'kafka', 'sqs', 'rabbitmq', 'pub/sub', 'pubsub', 'message queue', 'nats', 'broker'],
  datastore: [
    'database', ' db', 'db ', 'postgres', 'mysql', 'dynamodb', 'cassandra', 'mongodb', 'cockroachdb',
    'sqlite', 'maria', 'aurora', 'spanner', 'key-value store', 'kv store', 'datastore', 'clickhouse', 'elasticsearch',
  ],
  cdn: ['cdn'],
  // LLD / class-design roles: keyed off UML-style stereotype text or the word itself in the label.
  interface: ['interface', '<<interface>>', 'protocol'],
  abstractClass: ['abstract'],
  enumType: ['enum', 'enumeration', '<<enum>>'],
};

export function rolesFor(label: string): Role[] {
  // A label wraps onto multiple lines the moment it's longer than its box (e.g. "Load\nBalancer"
  // inside a narrow rectangle) — collapse whitespace so keyword matches aren't line-broken apart.
  const l = ` ${label.toLowerCase().replace(/\s+/g, ' ')} `;
  const roles: Role[] = [];
  for (const [role, keywords] of Object.entries(ROLE_KEYWORDS) as [Role, string[]][]) {
    if (keywords.some((k) => l.includes(k))) roles.push(role);
  }
  return roles;
}

function overlaps(a: ExcalidrawElement, b: ExcalidrawElement): boolean {
  // b's center point lying inside a's bounding box is enough to treat b as a's label —
  // generous on purpose, since people rarely align a dropped-on label pixel-perfectly.
  const bcx = b.x + b.width / 2;
  const bcy = b.y + b.height / 2;
  return bcx >= a.x && bcx <= a.x + a.width && bcy >= a.y && bcy <= a.y + a.height;
}

function labelFor(el: ExcalidrawElement, all: ExcalidrawElement[], textById: Map<string, ExcalidrawElement>): string {
  const boundTextId = el.boundElements?.find((b) => b.type === 'text')?.id;
  if (boundTextId) {
    const t = textById.get(boundTextId);
    if (t?.text?.trim()) return t.text.trim();
  }
  for (const t of textById.values()) {
    if (t.containerId === el.id && t.text?.trim()) return t.text.trim();
  }
  const overlap = all.find((t) => t.type === 'text' && t.id !== el.id && t.text?.trim() && overlaps(el, t));
  if (overlap?.text) return overlap.text.trim();
  return '';
}

export function parseScene(elements: ExcalidrawElement[]): SceneGraph {
  const live = (elements ?? []).filter((e) => e && !e.isDeleted);
  const byId = new Map(live.map((e) => [e.id, e]));
  const textById = new Map(live.filter((e) => e.type === 'text').map((e) => [e.id, e]));

  const nodes: SceneNode[] = [];
  for (const el of live) {
    if (!NODE_TYPES.has(el.type)) continue;
    const label = labelFor(el, live, textById);
    nodes.push({ id: el.id, label, roles: rolesFor(label), x: el.x, y: el.y, width: el.width, height: el.height });
  }

  const edges: SceneEdge[] = [];
  for (const el of live) {
    if (el.type !== 'arrow') continue;
    const from = el.startBinding?.elementId;
    const to = el.endBinding?.elementId;
    if (!from || !to || !byId.has(from) || !byId.has(to)) continue; // a dangling arrow carries no topology
    edges.push({ id: el.id, from, to, label: labelFor(el, live, textById) || null });
  }

  const allText = dedupe(
    [...live.filter((e) => e.type === 'text' && e.text?.trim()).map((e) => e.text!.trim()), ...nodes.map((n) => n.label)].filter(Boolean),
  );

  return { nodes, edges, allText };
}

function dedupe(xs: string[]): string[] {
  return [...new Set(xs)];
}
