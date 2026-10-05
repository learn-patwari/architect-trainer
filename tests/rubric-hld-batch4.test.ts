import { describe, expect, it } from 'vitest';
import { runRubric } from '../shared/rubric/run.ts';
import type { RubricCheckResult } from '../shared/rubric/types.ts';
import type { SceneGraph } from '../shared/scene/types.ts';
import { DISTRIBUTED_CACHE } from '../shared/hld/distributed-cache.ts';
import { NOTIFICATION_SYSTEM } from '../shared/hld/notification-system.ts';
import { TYPEAHEAD_SYSTEM } from '../shared/hld/typeahead-system.ts';

function node(id: string, label: string, roles: SceneGraph['nodes'][number]['roles']): SceneGraph['nodes'][number] {
  return { id, label, roles, x: 0, y: 0, width: 100, height: 60 };
}
function edge(from: string, to: string): SceneGraph['edges'][number] {
  return { id: `${from}-${to}`, from, to, label: null };
}
function graph(nodes: SceneGraph['nodes'], edges: SceneGraph['edges'] = [], extraText: string[] = []): SceneGraph {
  return { nodes, edges, allText: [...nodes.map((n) => n.label), ...extraText] };
}
function checkById(breakdown: RubricCheckResult[], id: string): RubricCheckResult {
  return breakdown.find((c) => c.id === id)!;
}

describe('typeahead system HLD rubric', () => {
  it('scores a fully-wired design highly', () => {
    const g = graph(
      [node('lb', 'Load Balancer', ['loadBalancer']), node('app', 'Suggestion Service', ['appServer']), node('cache', 'Redis Cache', ['cache'])],
      [edge('lb', 'app'), edge('app', 'cache')],
      ['Trie with top-K cached per node', 'Ranking by frequency/popularity', 'Nightly job rebuilds the trie on a rolling window'],
    );
    const r = runRubric(TYPEAHEAD_SYSTEM.rubric, g);
    expect(checkById(r.breakdown, 'trie-index-named').verdict).toBe('pass');
    expect(checkById(r.breakdown, 'caching-hot-prefixes').verdict).toBe('pass');
    expect(checkById(r.breakdown, 'offline-aggregation').verdict).toBe('pass');
    expect(r.percent).toBeGreaterThan(70);
  });

  it('fails the trie and offline-aggregation checks when neither is named', () => {
    const g = graph([node('app', 'Service', ['appServer'])]);
    const r = runRubric(TYPEAHEAD_SYSTEM.rubric, g);
    expect(checkById(r.breakdown, 'trie-index-named').verdict).toBe('fail');
    expect(checkById(r.breakdown, 'offline-aggregation').verdict).toBe('fail');
  });
});

describe('notification system HLD rubric', () => {
  it('scores a fully-wired design highly', () => {
    const g = graph(
      [node('app', 'Ingestion Service', ['appServer']), node('queue', 'Kafka', ['queue']), node('db', 'Delivery Status DB', ['datastore'])],
      [edge('app', 'queue'), edge('app', 'db')],
      ['Delivers via push notification and email', 'Idempotency check on notification ID', 'Rendered from a template per user preference'],
    );
    const r = runRubric(NOTIFICATION_SYSTEM.rubric, g);
    expect(checkById(r.breakdown, 'multi-channel').verdict).toBe('pass');
    expect(checkById(r.breakdown, 'dedup-idempotency').verdict).toBe('pass');
    expect(r.percent).toBeGreaterThan(70);
  });

  it('fails the multi-channel check when only one channel is named', () => {
    const g = graph([node('app', 'Service', ['appServer'])], [], ['Sends an email']);
    const r = runRubric(NOTIFICATION_SYSTEM.rubric, g);
    expect(checkById(r.breakdown, 'multi-channel').verdict).toBe('partial');
  });

  it('fails dedup when nothing is named', () => {
    const g = graph([node('app', 'Service', ['appServer'])]);
    expect(checkById(runRubric(NOTIFICATION_SYSTEM.rubric, g).breakdown, 'dedup-idempotency').verdict).toBe('fail');
  });
});

describe('distributed cache HLD rubric', () => {
  it('scores a fully-wired design highly', () => {
    const g = graph(
      [node('c1', 'Cache Node 1', ['cache']), node('c2', 'Cache Node 2', ['cache'])],
      [],
      ['Consistent hashing ring for key placement', 'LRU eviction', 'Replicated to a second node', 'Client-side hashing via a cluster map', 'Hot key gets request coalescing', 'Cache-aside invalidation on write'],
    );
    const r = runRubric(DISTRIBUTED_CACHE.rubric, g);
    expect(checkById(r.breakdown, 'cache-tier-redundant').verdict).toBe('pass');
    expect(checkById(r.breakdown, 'consistent-hashing').verdict).toBe('pass');
    expect(checkById(r.breakdown, 'hot-key-handling').verdict).toBe('pass');
    expect(r.percent).toBeGreaterThan(70);
  });

  it('fails the cache-redundancy and consistent-hashing checks for a single node', () => {
    const g = graph([node('c1', 'Cache', ['cache'])]);
    const r = runRubric(DISTRIBUTED_CACHE.rubric, g);
    expect(checkById(r.breakdown, 'cache-tier-redundant').verdict).toBe('fail');
    expect(checkById(r.breakdown, 'consistent-hashing').verdict).toBe('fail');
  });
});
