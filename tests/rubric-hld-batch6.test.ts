import { describe, expect, it } from 'vitest';
import { runRubric } from '../shared/rubric/run.ts';
import type { RubricCheckResult } from '../shared/rubric/types.ts';
import type { SceneGraph } from '../shared/scene/types.ts';
import { DISTRIBUTED_EMAIL_SERVICE } from '../shared/hld/distributed-email-service.ts';
import { GAMING_LEADERBOARD } from '../shared/hld/gaming-leaderboard.ts';
import { GOOGLE_MAPS } from '../shared/hld/google-maps.ts';
import { HOTEL_RESERVATION_SYSTEM } from '../shared/hld/hotel-reservation-system.ts';
import { METRICS_MONITORING_SYSTEM } from '../shared/hld/metrics-monitoring-system.ts';
import { NEARBY_FRIENDS } from '../shared/hld/nearby-friends.ts';
import { OBJECT_STORAGE_SYSTEM } from '../shared/hld/object-storage-system.ts';
import { PROXIMITY_SERVICE } from '../shared/hld/proximity-service.ts';
import { STOCK_EXCHANGE } from '../shared/hld/stock-exchange.ts';
import { VIDEO_STREAMING_PLATFORM } from '../shared/hld/video-streaming-platform.ts';

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

describe('YouTube (video streaming) HLD rubric', () => {
  it('scores a fully-wired design highly', () => {
    const g = graph(
      [node('lb', 'Load Balancer', ['loadBalancer']), node('app1', 'App 1', ['appServer']), node('app2', 'App 2', ['appServer']), node('cdn', 'CDN', ['cdn'])],
      [edge('lb', 'app1'), edge('lb', 'app2')],
      ['Raw upload to S3 object storage', 'Async transcoding pipeline via a queue', 'Multiple resolutions for adaptive bitrate', 'Playback served through the CDN', 'Video metadata store'],
    );
    const r = runRubric(VIDEO_STREAMING_PLATFORM.rubric, g);
    expect(checkById(r.breakdown, 'async-transcoding').verdict).toBe('pass');
    expect(checkById(r.breakdown, 'multiple-resolutions').verdict).toBe('pass');
    expect(checkById(r.breakdown, 'cdn-for-playback').verdict).toBe('pass');
    expect(r.percent).toBeGreaterThan(70);
  });

  it('fails transcoding and resolution checks when neither is named', () => {
    const g = graph([node('app', 'Service', ['appServer'])]);
    const r = runRubric(VIDEO_STREAMING_PLATFORM.rubric, g);
    expect(checkById(r.breakdown, 'async-transcoding').verdict).toBe('fail');
    expect(checkById(r.breakdown, 'multiple-resolutions').verdict).toBe('fail');
  });
});

describe('proximity service HLD rubric', () => {
  it('scores a fully-wired design highly', () => {
    const g = graph(
      [node('lb', 'Load Balancer', ['loadBalancer']), node('app1', 'App 1', ['appServer']), node('app2', 'App 2', ['appServer']), node('cache', 'Redis', ['cache']), node('db', 'Postgres', ['datastore'])],
      [edge('lb', 'app1'), edge('lb', 'app2'), edge('app1', 'cache'), edge('app1', 'db')],
      ['Geohash index for nearby lookups', 'Read-heavy workload, rarely-changing locations', 'Expand the search radius when sparse'],
    );
    const r = runRubric(PROXIMITY_SERVICE.rubric, g);
    expect(checkById(r.breakdown, 'geo-index-named').verdict).toBe('pass');
    expect(checkById(r.breakdown, 'cache-layer').verdict).toBe('pass');
    expect(r.percent).toBeGreaterThan(70);
  });

  it('fails geo-index when nothing is named', () => {
    const g = graph([node('app', 'Service', ['appServer'])]);
    const r = runRubric(PROXIMITY_SERVICE.rubric, g);
    expect(checkById(r.breakdown, 'geo-index-named').verdict).toBe('fail');
  });
});

describe('nearby friends HLD rubric', () => {
  it('scores a fully-wired design highly', () => {
    const g = graph(
      [node('lb', 'Load Balancer', ['loadBalancer']), node('app1', 'App 1', ['appServer']), node('app2', 'App 2', ['appServer']), node('cache', 'Redis geo', ['cache'])],
      [edge('lb', 'app1'), edge('lb', 'app2'), edge('app1', 'cache')],
      ['WebSocket persistent connection', 'In-memory Redis geo index for current location', 'Geohash for lookups', 'Fan-out only to friend list subscribers', 'TTL expires a stale location', 'Write-heavy workload with frequent updates'],
    );
    const r = runRubric(NEARBY_FRIENDS.rubric, g);
    expect(checkById(r.breakdown, 'persistent-connection').verdict).toBe('pass');
    expect(checkById(r.breakdown, 'in-memory-location-index').verdict).toBe('pass');
    expect(checkById(r.breakdown, 'fanout-named').verdict).toBe('pass');
    expect(r.percent).toBeGreaterThan(70);
  });

  it('fails persistent-connection and fanout when neither is named', () => {
    const g = graph([node('app', 'Service', ['appServer'])]);
    const r = runRubric(NEARBY_FRIENDS.rubric, g);
    expect(checkById(r.breakdown, 'persistent-connection').verdict).toBe('fail');
    expect(checkById(r.breakdown, 'fanout-named').verdict).toBe('fail');
  });
});

describe('Google Maps HLD rubric', () => {
  it('scores a fully-wired design highly', () => {
    const g = graph(
      [node('lb', 'Load Balancer', ['loadBalancer']), node('app', 'Routing Service', ['appServer']), node('cdn', 'CDN', ['cdn'])],
      [edge('lb', 'app')],
      ['Road network modeled as a graph, Dijkstra shortest path', 'Contraction hierarchies precomputed offline', 'Map tiles pre-rendered and served through the CDN', 'Live traffic updates edge weights', 'Reroute on deviation'],
    );
    const r = runRubric(GOOGLE_MAPS.rubric, g);
    expect(checkById(r.breakdown, 'graph-model-named').verdict).toBe('pass');
    expect(checkById(r.breakdown, 'precomputation-named').verdict).toBe('pass');
    expect(checkById(r.breakdown, 'map-tiling').verdict).toBe('pass');
    expect(r.percent).toBeGreaterThan(70);
  });

  it('fails graph-model and precomputation checks when neither is named', () => {
    const g = graph([node('app', 'Service', ['appServer'])]);
    const r = runRubric(GOOGLE_MAPS.rubric, g);
    expect(checkById(r.breakdown, 'graph-model-named').verdict).toBe('fail');
    expect(checkById(r.breakdown, 'precomputation-named').verdict).toBe('fail');
  });
});

describe('metrics monitoring system HLD rubric', () => {
  it('scores a fully-wired design highly', () => {
    const g = graph(
      [node('lb', 'Load Balancer', ['loadBalancer']), node('q', 'Kafka', ['queue']), node('db', 'Prometheus TSDB', ['datastore'])],
      [edge('q', 'db')],
      ['Pull model scraping metrics', 'Time-series database', 'Downsampling rollup with a retention policy', 'Alert evaluator is a separate component', 'Debounce to avoid flapping alerts', 'Aggregated queries for dashboards'],
    );
    const r = runRubric(METRICS_MONITORING_SYSTEM.rubric, g);
    expect(checkById(r.breakdown, 'tsdb-named').verdict).toBe('pass');
    expect(checkById(r.breakdown, 'downsampling-named').verdict).toBe('pass');
    expect(checkById(r.breakdown, 'alerting-decoupled').verdict).toBe('pass');
    expect(r.percent).toBeGreaterThan(70);
  });

  it('fails tsdb and downsampling checks when neither is named', () => {
    const g = graph([node('db', 'Database', ['datastore'])]);
    const r = runRubric(METRICS_MONITORING_SYSTEM.rubric, g);
    expect(checkById(r.breakdown, 'tsdb-named').verdict).toBe('fail');
    expect(checkById(r.breakdown, 'downsampling-named').verdict).toBe('fail');
  });
});

describe('hotel reservation system HLD rubric', () => {
  it('scores a fully-wired design highly', () => {
    const g = graph(
      [node('lb', 'Load Balancer', ['loadBalancer']), node('app1', 'App 1', ['appServer']), node('app2', 'App 2', ['appServer']), node('cache', 'Availability Cache', ['cache']), node('db', 'Postgres', ['datastore'])],
      [edge('lb', 'app1'), edge('lb', 'app2'), edge('app1', 'cache'), edge('app1', 'db')],
      ['Row lock (SELECT FOR UPDATE) on inventory', 'Reservation hold with a TTL', 'Idempotency key on booking confirmation', 'Overbook buffer of 2%', 'Payment confirms the booking'],
    );
    const r = runRubric(HOTEL_RESERVATION_SYSTEM.rubric, g);
    expect(checkById(r.breakdown, 'concurrency-control').verdict).toBe('pass');
    expect(checkById(r.breakdown, 'hold-with-ttl').verdict).toBe('pass');
    expect(r.percent).toBeGreaterThan(70);
  });

  it('fails concurrency-control when nothing is named', () => {
    const g = graph([node('app', 'Service', ['appServer']), node('db', 'DB', ['datastore'])]);
    const r = runRubric(HOTEL_RESERVATION_SYSTEM.rubric, g);
    expect(checkById(r.breakdown, 'concurrency-control').verdict).toBe('fail');
  });
});

describe('distributed email service HLD rubric', () => {
  it('scores a fully-wired design highly', () => {
    const g = graph(
      [node('lb', 'Load Balancer', ['loadBalancer']), node('app1', 'App 1', ['appServer']), node('app2', 'App 2', ['appServer']), node('q', 'Send Queue', ['queue']), node('db', 'Metadata DB', ['datastore'])],
      [edge('lb', 'app1'), edge('lb', 'app2'), edge('app1', 'q'), edge('app1', 'db')],
      ['Body and attachments in S3 object storage', 'Elasticsearch full-text search index', 'Many-to-many label model', 'Async outbound send via the queue', 'Retry with backoff and bounce notice', 'Spam filter on inbound mail'],
    );
    const r = runRubric(DISTRIBUTED_EMAIL_SERVICE.rubric, g);
    expect(checkById(r.breakdown, 'body-in-object-storage').verdict).toBe('pass');
    expect(checkById(r.breakdown, 'search-index-named').verdict).toBe('pass');
    expect(checkById(r.breakdown, 'async-outbound-send').verdict).toBe('pass');
    expect(r.percent).toBeGreaterThan(70);
  });

  it('fails object-storage and search-index checks when neither is named', () => {
    const g = graph([node('app', 'Service', ['appServer']), node('db', 'DB', ['datastore'])]);
    const r = runRubric(DISTRIBUTED_EMAIL_SERVICE.rubric, g);
    expect(checkById(r.breakdown, 'body-in-object-storage').verdict).toBe('fail');
    expect(checkById(r.breakdown, 'search-index-named').verdict).toBe('fail');
  });
});

describe('S3-like object storage HLD rubric', () => {
  it('scores a fully-wired design highly', () => {
    const g = graph(
      [node('n1', 'Data Node 1', ['datastore']), node('n2', 'Data Node 2', ['datastore']), node('n3', 'Data Node 3', ['datastore'])],
      [],
      ['Metadata service maps key to location', 'Large objects split into chunks', 'Consistent hashing for chunk placement', 'Erasure coding for durability', 'Checksums catch bit rot', 'Immutable objects with versioning', 'Deleted chunks garbage collected asynchronously'],
    );
    const r = runRubric(OBJECT_STORAGE_SYSTEM.rubric, g);
    expect(checkById(r.breakdown, 'metadata-vs-data-split').verdict).toBe('pass');
    expect(checkById(r.breakdown, 'durability-mechanism').verdict).toBe('pass');
    expect(r.percent).toBeGreaterThan(70);
  });

  it('fails metadata-split and durability checks when neither is named', () => {
    const g = graph([node('n1', 'Node', ['datastore'])]);
    const r = runRubric(OBJECT_STORAGE_SYSTEM.rubric, g);
    expect(checkById(r.breakdown, 'metadata-vs-data-split').verdict).toBe('fail');
    expect(checkById(r.breakdown, 'durability-mechanism').verdict).toBe('fail');
  });
});

describe('real-time gaming leaderboard HLD rubric', () => {
  it('scores a fully-wired design highly', () => {
    const g = graph(
      [node('lb', 'Load Balancer', ['loadBalancer']), node('app1', 'App 1', ['appServer']), node('app2', 'App 2', ['appServer']), node('cache', 'Redis Sorted Set', ['cache'])],
      [edge('lb', 'app1'), edge('lb', 'app2'), edge('app1', 'cache')],
      ['Redis sorted set for ranking', 'Async persist as a periodic snapshot', 'Top-K and rank-near-me range queries', 'Shard the leaderboard by player ID, merge shards for global top-K', 'Tiebreak by whoever reached the score first'],
    );
    const r = runRubric(GAMING_LEADERBOARD.rubric, g);
    expect(checkById(r.breakdown, 'sorted-structure-named').verdict).toBe('pass');
    expect(checkById(r.breakdown, 'sharding-for-scale').verdict).toBe('pass');
    expect(r.percent).toBeGreaterThan(70);
  });

  it('fails sorted-structure when nothing is named', () => {
    const g = graph([node('app', 'Service', ['appServer'])]);
    const r = runRubric(GAMING_LEADERBOARD.rubric, g);
    expect(checkById(r.breakdown, 'sorted-structure-named').verdict).toBe('fail');
  });
});

describe('stock exchange (matching engine) HLD rubric', () => {
  it('scores a fully-wired design highly', () => {
    const g = graph(
      [node('m1', 'Matching Core - AAPL', ['appServer']), node('m2', 'Matching Core - GOOG', ['appServer'])],
      [],
      [
        'Limit order book with bids and asks',
        'Price-time priority matching',
        'Single-threaded matching core per instrument',
        'Shard by instrument across matching cores',
        'Write-ahead log replays order/trade history',
        'Sequence number for idempotent order submission',
        'Market data feed publishes executed trades',
      ],
    );
    const r = runRubric(STOCK_EXCHANGE.rubric, g);
    expect(checkById(r.breakdown, 'order-book-named').verdict).toBe('pass');
    expect(checkById(r.breakdown, 'single-writer-per-instrument').verdict).toBe('pass');
    expect(checkById(r.breakdown, 'horizontal-scale-via-sharding').verdict).toBe('pass');
    expect(r.percent).toBeGreaterThan(70);
  });

  it('fails order-book and single-writer checks when neither is named', () => {
    const g = graph([node('app', 'Service', ['appServer'])]);
    const r = runRubric(STOCK_EXCHANGE.rubric, g);
    expect(checkById(r.breakdown, 'order-book-named').verdict).toBe('fail');
    expect(checkById(r.breakdown, 'single-writer-per-instrument').verdict).toBe('fail');
  });
});
