import { describe, expect, it } from 'vitest';
import { runRubric } from '../shared/rubric/run.ts';
import type { RubricCheckResult } from '../shared/rubric/types.ts';
import type { SceneGraph } from '../shared/scene/types.ts';
import { FLASH_SALE } from '../shared/hld/flash-sale.ts';
import { MULTI_REGION } from '../shared/hld/multi-region.ts';
import { MULTI_TENANT } from '../shared/hld/multi-tenant.ts';

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

describe('flash sale HLD rubric', () => {
  it('scores a fully-wired design highly', () => {
    const g = graph(
      [
        node('lb', 'Load Balancer', ['loadBalancer']),
        node('app', 'Flash Sale Service', ['appServer']),
        node('queue', 'Kafka', ['queue']),
        node('db', 'Postgres', ['datastore']),
      ],
      [edge('lb', 'app'), edge('app', 'queue'), edge('app', 'db')],
      ['Atomic decrement via Redis DECR', 'Rate limit at the edge with a waiting room', 'Dedicated isolated service, bulkhead from main site'],
    );
    const r = runRubric(FLASH_SALE.rubric, g);
    expect(checkById(r.breakdown, 'atomic-inventory').verdict).toBe('pass');
    expect(checkById(r.breakdown, 'traffic-shedding').verdict).toBe('pass');
    expect(checkById(r.breakdown, 'isolated-from-main-site').verdict).toBe('pass');
    expect(r.percent).toBeGreaterThan(70);
  });

  it('fails the atomic-inventory check when no atomic mechanism is named (the classic overselling bug)', () => {
    const g = graph([node('app', 'App', ['appServer']), node('db', 'DB', ['datastore'])], [edge('app', 'db')]);
    expect(checkById(runRubric(FLASH_SALE.rubric, g).breakdown, 'atomic-inventory').verdict).toBe('fail');
  });
});

describe('multi-region HLD rubric', () => {
  it('scores a fully-wired design highly', () => {
    const g = graph(
      [node('lb', 'Load Balancer', ['loadBalancer']), node('app', 'App Server', ['appServer']), node('db', 'Postgres', ['datastore'])],
      [edge('lb', 'app'), edge('app', 'db')],
      ['Route 53 latency-based routing to nearest region', 'Active-passive cross-region replication', 'Automatic failover with RPO of a few seconds, RTO of minutes'],
    );
    const r = runRubric(MULTI_REGION.rubric, g);
    expect(checkById(r.breakdown, 'global-routing').verdict).toBe('pass');
    expect(checkById(r.breakdown, 'cross-region-replication').verdict).toBe('pass');
    expect(checkById(r.breakdown, 'failover-named').verdict).toBe('pass');
    expect(r.percent).toBeGreaterThan(70);
  });

  it('fails global-routing and replication checks when neither is mentioned', () => {
    const g = graph([node('lb', 'LB', ['loadBalancer']), node('app', 'App', ['appServer']), node('db', 'DB', ['datastore'])], [edge('lb', 'app'), edge('app', 'db')]);
    const r = runRubric(MULTI_REGION.rubric, g);
    expect(checkById(r.breakdown, 'global-routing').verdict).toBe('fail');
    expect(checkById(r.breakdown, 'cross-region-replication').verdict).toBe('fail');
  });
});

describe('multi-tenant SaaS HLD rubric', () => {
  it('scores a fully-wired design highly', () => {
    const g = graph(
      [node('lb', 'Load Balancer', ['loadBalancer']), node('app', 'App Server', ['appServer']), node('db', 'Postgres', ['datastore'])],
      [edge('lb', 'app'), edge('app', 'db')],
      ['Tenant identified by JWT claim', 'Pool model: shared DB with tenant_id column and row-level security', 'Per-tenant rate limit to avoid noisy neighbor; whale tenants get dedicated infra'],
    );
    const r = runRubric(MULTI_TENANT.rubric, g);
    expect(checkById(r.breakdown, 'tenant-identification').verdict).toBe('pass');
    expect(checkById(r.breakdown, 'isolation-model').verdict).toBe('pass');
    expect(checkById(r.breakdown, 'noisy-neighbor').verdict).toBe('pass');
    expect(r.percent).toBeGreaterThan(70);
  });

  it('fails the isolation-model and noisy-neighbor checks when neither is named', () => {
    const g = graph([node('lb', 'LB', ['loadBalancer']), node('app', 'App', ['appServer']), node('db', 'DB', ['datastore'])], [edge('lb', 'app'), edge('app', 'db')]);
    const r = runRubric(MULTI_TENANT.rubric, g);
    expect(checkById(r.breakdown, 'isolation-model').verdict).toBe('fail');
    expect(checkById(r.breakdown, 'noisy-neighbor').verdict).toBe('fail');
  });
});
