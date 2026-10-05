import { describe, expect, it } from 'vitest';
import { runRubric } from '../shared/rubric/run.ts';
import type { RubricCheckResult } from '../shared/rubric/types.ts';
import type { SceneGraph } from '../shared/scene/types.ts';
import { FILE_SYNC } from '../shared/hld/file-sync.ts';
import { PAYMENT_SYSTEM } from '../shared/hld/payment-system.ts';
import { RIDE_SHARING } from '../shared/hld/ride-sharing.ts';
import { TICKET_BOOKING } from '../shared/hld/ticket-booking.ts';
import { WEB_CRAWLER } from '../shared/hld/web-crawler.ts';

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

describe('ride-sharing HLD rubric', () => {
  it('scores a fully-wired design highly', () => {
    const g = graph(
      [
        node('lb', 'Load Balancer', ['loadBalancer']),
        node('app', 'App Server', ['appServer']),
        node('cache', 'Redis Geo Cache', ['cache']),
        node('db', 'Postgres', ['datastore']),
      ],
      [edge('lb', 'app'), edge('app', 'cache'), edge('app', 'db')],
      ['Geohash-based geospatial index for nearby drivers', 'Nearest driver dispatch algorithm'],
    );
    const r = runRubric(RIDE_SHARING.rubric, g);
    expect(checkById(r.breakdown, 'geo-index-named').verdict).toBe('pass');
    expect(checkById(r.breakdown, 'live-location-cache').verdict).toBe('pass');
    expect(checkById(r.breakdown, 'matching-strategy').verdict).toBe('pass');
    expect(r.percent).toBeGreaterThan(70);
  });

  it('fails the geo-index check when no spatial index is named', () => {
    const g = graph([node('app', 'App', ['appServer']), node('db', 'DB', ['datastore'])], [edge('app', 'db')]);
    expect(checkById(runRubric(RIDE_SHARING.rubric, g).breakdown, 'geo-index-named').verdict).toBe('fail');
  });
});

describe('ticket booking HLD rubric', () => {
  it('scores a fully-wired design highly', () => {
    const g = graph(
      [node('lb', 'Load Balancer', ['loadBalancer']), node('app', 'App Server', ['appServer']), node('db', 'Postgres', ['datastore'])],
      [edge('lb', 'app'), edge('app', 'db')],
      ['Conditional update to place a hold', 'Redis TTL on the hold', 'Rate limit at the edge with a waiting room'],
    );
    const r = runRubric(TICKET_BOOKING.rubric, g);
    expect(checkById(r.breakdown, 'atomic-seat-lock').verdict).toBe('pass');
    expect(checkById(r.breakdown, 'hold-expiry').verdict).toBe('pass');
    expect(r.percent).toBeGreaterThan(70);
  });

  it('fails the hold-expiry check when no expiry mechanism is named', () => {
    const g = graph([node('app', 'App', ['appServer']), node('db', 'DB', ['datastore'])], [edge('app', 'db')], ['conditional update']);
    expect(checkById(runRubric(TICKET_BOOKING.rubric, g).breakdown, 'hold-expiry').verdict).toBe('fail');
  });
});

describe('web crawler HLD rubric', () => {
  it('scores a fully-wired design highly', () => {
    const g = graph(
      [node('queue', 'Frontier Queue', ['queue']), node('worker', 'Fetcher Workers', ['appServer']), node('db', 'S3 + Metadata DB', ['datastore'])],
      [edge('queue', 'worker'), edge('worker', 'db')],
      ['Bloom filter for seen URLs', 'Per-domain rate limit / politeness', 'HTML parser extracts links'],
    );
    const r = runRubric(WEB_CRAWLER.rubric, g);
    expect(checkById(r.breakdown, 'frontier-wired').verdict).toBe('pass');
    expect(checkById(r.breakdown, 'dedup-mechanism').verdict).toBe('pass');
    expect(checkById(r.breakdown, 'politeness-named').verdict).toBe('pass');
    expect(r.percent).toBeGreaterThan(70);
  });

  it('fails the dedup and politeness checks when neither is named', () => {
    const g = graph([node('queue', 'Frontier', ['queue']), node('worker', 'Worker', ['appServer'])], [edge('queue', 'worker')]);
    const r = runRubric(WEB_CRAWLER.rubric, g);
    expect(checkById(r.breakdown, 'dedup-mechanism').verdict).toBe('fail');
    expect(checkById(r.breakdown, 'politeness-named').verdict).toBe('fail');
  });
});

describe('payment system HLD rubric', () => {
  it('scores a fully-wired design highly', () => {
    const g = graph(
      [node('lb', 'Load Balancer', ['loadBalancer']), node('app', 'App Server', ['appServer']), node('queue', 'Kafka', ['queue']), node('db', 'Postgres Ledger', ['datastore'])],
      [edge('lb', 'app'), edge('app', 'queue'), edge('app', 'db')],
      ['Idempotency key on every charge request', 'Double-entry ledger for all transactions'],
    );
    const r = runRubric(PAYMENT_SYSTEM.rubric, g);
    expect(checkById(r.breakdown, 'idempotency-key').verdict).toBe('pass');
    expect(checkById(r.breakdown, 'ledger-model').verdict).toBe('pass');
    expect(r.percent).toBeGreaterThan(70);
  });

  it('fails idempotency and ledger checks when neither is named', () => {
    const g = graph([node('app', 'App', ['appServer']), node('db', 'DB', ['datastore'])], [edge('app', 'db')]);
    const r = runRubric(PAYMENT_SYSTEM.rubric, g);
    expect(checkById(r.breakdown, 'idempotency-key').verdict).toBe('fail');
    expect(checkById(r.breakdown, 'ledger-model').verdict).toBe('fail');
  });
});

describe('file sync HLD rubric', () => {
  it('scores a fully-wired design highly', () => {
    const g = graph(
      [node('lb', 'Load Balancer', ['loadBalancer']), node('app', 'App Server', ['appServer']), node('db', 'Metadata DB', ['datastore'])],
      [edge('lb', 'app'), edge('app', 'db')],
      ['Files stored in S3 object storage', 'Chunking with delta sync for large files', 'Version vector for conflict resolution'],
    );
    const r = runRubric(FILE_SYNC.rubric, g);
    expect(checkById(r.breakdown, 'object-storage-named').verdict).toBe('pass');
    expect(checkById(r.breakdown, 'chunking-named').verdict).toBe('pass');
    expect(checkById(r.breakdown, 'conflict-resolution').verdict).toBe('pass');
    expect(r.percent).toBeGreaterThan(70);
  });

  it('fails the conflict-resolution check when nothing is named for offline edits', () => {
    const g = graph([node('app', 'App', ['appServer']), node('db', 'DB', ['datastore'])], [edge('app', 'db')], ['s3', 'chunking']);
    expect(checkById(runRubric(FILE_SYNC.rubric, g).breakdown, 'conflict-resolution').verdict).toBe('fail');
  });
});
