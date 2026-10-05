import { describe, expect, it } from 'vitest';
import { runRubric } from '../shared/rubric/run.ts';
import type { RubricCheckResult } from '../shared/rubric/types.ts';
import type { SceneGraph } from '../shared/scene/types.ts';
import { AD_CLICK_AGGREGATION } from '../shared/hld/ad-click-aggregation.ts';
import { CONSISTENT_HASHING_DESIGN } from '../shared/hld/consistent-hashing-design.ts';
import { DIGITAL_WALLET } from '../shared/hld/digital-wallet.ts';
import { DISTRIBUTED_KEY_VALUE_STORE } from '../shared/hld/distributed-key-value-store.ts';
import { DISTRIBUTED_MESSAGE_QUEUE } from '../shared/hld/distributed-message-queue.ts';
import { DISTRIBUTED_RATE_LIMITER } from '../shared/hld/distributed-rate-limiter.ts';

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

describe('distributed rate limiter HLD rubric', () => {
  it('scores a fully-wired design highly', () => {
    const g = graph(
      [node('lb', 'Load Balancer', ['loadBalancer']), node('app1', 'App Server 1', ['appServer']), node('app2', 'App Server 2', ['appServer']), node('redis', 'Redis', ['cache'])],
      [edge('lb', 'app1'), edge('lb', 'app2'), edge('app1', 'redis'), edge('app2', 'redis')],
      ['Token bucket algorithm', 'Atomic Lua script increments the counter', 'Per-user rate limit', 'Fail open if Redis is down', 'Returns HTTP 429 with Retry-After'],
    );
    const r = runRubric(DISTRIBUTED_RATE_LIMITER.rubric, g);
    expect(checkById(r.breakdown, 'shared-store').verdict).toBe('pass');
    expect(checkById(r.breakdown, 'algorithm-named').verdict).toBe('pass');
    expect(checkById(r.breakdown, 'atomicity-named').verdict).toBe('pass');
    expect(r.percent).toBeGreaterThan(70);
  });

  it('fails shared-store and atomicity when a bare single app server is drawn', () => {
    const g = graph([node('app', 'App Server', ['appServer'])]);
    const r = runRubric(DISTRIBUTED_RATE_LIMITER.rubric, g);
    expect(checkById(r.breakdown, 'shared-store').verdict).toBe('fail');
    expect(checkById(r.breakdown, 'atomicity-named').verdict).toBe('fail');
  });
});

describe('consistent hashing design HLD rubric', () => {
  it('scores a fully-wired design highly', () => {
    const g = graph(
      [node('n1', 'Node 1', ['datastore']), node('n2', 'Node 2', ['datastore']), node('n3', 'Node 3', ['datastore'])],
      [],
      ['Hash ring for placement', 'Adding a node only reshuffles a small fraction of keys', 'Virtual nodes for even distribution', 'Skew/hotspot risk without them', 'Replicated to N successor nodes', 'Gossip protocol for membership'],
    );
    const r = runRubric(CONSISTENT_HASHING_DESIGN.rubric, g);
    expect(checkById(r.breakdown, 'ring-named').verdict).toBe('pass');
    expect(checkById(r.breakdown, 'virtual-nodes').verdict).toBe('pass');
    expect(r.percent).toBeGreaterThan(70);
  });

  it('fails ring and virtual-node checks when neither is named', () => {
    const g = graph([node('n1', 'Node', ['datastore'])]);
    const r = runRubric(CONSISTENT_HASHING_DESIGN.rubric, g);
    expect(checkById(r.breakdown, 'ring-named').verdict).toBe('fail');
    expect(checkById(r.breakdown, 'virtual-nodes').verdict).toBe('fail');
  });
});

describe('distributed key-value store HLD rubric', () => {
  it('scores a fully-wired design highly', () => {
    const g = graph(
      [node('n1', 'Node 1', ['datastore']), node('n2', 'Node 2', ['datastore'])],
      [],
      [
        'Consistent hashing for partitioning',
        'Replicated to N nodes',
        'Quorum reads and writes, W + R > N',
        'Vector clocks for conflict resolution',
        'Write-ahead log for durability',
        'Merkle tree anti-entropy',
        'Gossip for membership',
      ],
    );
    const r = runRubric(DISTRIBUTED_KEY_VALUE_STORE.rubric, g);
    expect(checkById(r.breakdown, 'quorum-named').verdict).toBe('pass');
    expect(checkById(r.breakdown, 'conflict-resolution').verdict).toBe('pass');
    expect(r.percent).toBeGreaterThan(70);
  });

  it('fails quorum and conflict-resolution when neither is named', () => {
    const g = graph([node('n1', 'Node', ['datastore'])]);
    const r = runRubric(DISTRIBUTED_KEY_VALUE_STORE.rubric, g);
    expect(checkById(r.breakdown, 'quorum-named').verdict).toBe('fail');
    expect(checkById(r.breakdown, 'conflict-resolution').verdict).toBe('fail');
  });
});

describe('distributed message queue HLD rubric', () => {
  it('scores a fully-wired design highly', () => {
    const g = graph(
      [node('b1', 'Broker 1', ['datastore']), node('b2', 'Broker 2', ['datastore'])],
      [],
      [
        'Topic split into partitions',
        'Each partition replicated across brokers with a leader replica',
        'Append-only commit log on disk',
        'Ordering guaranteed within a partition',
        'Consumer group tracks offset per partition',
        'At-least-once delivery with acknowledgment',
        'Controller elected via KRaft',
      ],
    );
    const r = runRubric(DISTRIBUTED_MESSAGE_QUEUE.rubric, g);
    expect(checkById(r.breakdown, 'partitioning-named').verdict).toBe('pass');
    expect(checkById(r.breakdown, 'ordering-scope').verdict).toBe('pass');
    expect(r.percent).toBeGreaterThan(70);
  });

  it('fails partitioning and ordering-scope when neither is named', () => {
    const g = graph([node('b', 'Broker', ['datastore'])]);
    const r = runRubric(DISTRIBUTED_MESSAGE_QUEUE.rubric, g);
    expect(checkById(r.breakdown, 'partitioning-named').verdict).toBe('fail');
    expect(checkById(r.breakdown, 'ordering-scope').verdict).toBe('fail');
  });
});

describe('ad click event aggregation HLD rubric', () => {
  it('scores a fully-wired design highly', () => {
    const g = graph(
      [node('lb', 'Load Balancer', ['loadBalancer']), node('app', 'Ingestion Service', ['appServer']), node('q', 'Kafka', ['queue'])],
      [edge('lb', 'app'), edge('app', 'q')],
      ['Flink stream processor', 'Tumbling window by event time with a watermark', 'Late-arriving events handled by the watermark grace period', 'Dedup by unique click ID for idempotent counting', 'Nightly batch reconciliation job', 'Hot ad pre-aggregation before merge'],
    );
    const r = runRubric(AD_CLICK_AGGREGATION.rubric, g);
    expect(checkById(r.breakdown, 'stream-processor').verdict).toBe('pass');
    expect(checkById(r.breakdown, 'windowing-named').verdict).toBe('pass');
    expect(checkById(r.breakdown, 'dedup-named').verdict).toBe('pass');
    expect(r.percent).toBeGreaterThan(70);
  });

  it('fails windowing and dedup checks when neither is named', () => {
    const g = graph([node('app', 'Service', ['appServer'])]);
    const r = runRubric(AD_CLICK_AGGREGATION.rubric, g);
    expect(checkById(r.breakdown, 'windowing-named').verdict).toBe('fail');
    expect(checkById(r.breakdown, 'dedup-named').verdict).toBe('fail');
  });
});

describe('digital wallet HLD rubric', () => {
  it('scores a fully-wired design highly', () => {
    const g = graph(
      [node('lb', 'Load Balancer', ['loadBalancer']), node('app1', 'App Server 1', ['appServer']), node('app2', 'App Server 2', ['appServer']), node('db', 'Postgres', ['datastore'])],
      [edge('lb', 'app1'), edge('lb', 'app2'), edge('app1', 'db'), edge('app2', 'db')],
      ['Double-entry ledger with debit and credit entries', 'Immutable append-only ledger', 'Single ACID transaction commits both entries', 'Idempotency key on transfer requests', 'Balance check happens inside the same transaction', 'Nightly reconciliation audit'],
    );
    const r = runRubric(DIGITAL_WALLET.rubric, g);
    expect(checkById(r.breakdown, 'double-entry-ledger').verdict).toBe('pass');
    expect(checkById(r.breakdown, 'atomic-transfer').verdict).toBe('pass');
    expect(r.percent).toBeGreaterThan(70);
  });

  it('fails double-entry and atomic-transfer checks when neither is named', () => {
    const g = graph([node('app', 'Service', ['appServer']), node('db', 'DB', ['datastore'])]);
    const r = runRubric(DIGITAL_WALLET.rubric, g);
    expect(checkById(r.breakdown, 'double-entry-ledger').verdict).toBe('fail');
    expect(checkById(r.breakdown, 'atomic-transfer').verdict).toBe('fail');
  });
});
