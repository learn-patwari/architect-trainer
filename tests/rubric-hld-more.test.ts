import { describe, expect, it } from 'vitest';
import { runRubric } from '../shared/rubric/run.ts';
import type { RubricCheckResult } from '../shared/rubric/types.ts';
import type { SceneGraph } from '../shared/scene/types.ts';
import { CHAT_SYSTEM } from '../shared/hld/chat-system.ts';
import { NEWS_FEED } from '../shared/hld/news-feed.ts';

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

describe('news feed HLD rubric', () => {
  it('scores a fully-wired push-fan-out design highly', () => {
    const g = graph(
      [
        node('lb', 'Load Balancer', ['loadBalancer']),
        node('app', 'API Server', ['appServer']),
        node('queue', 'Kafka', ['queue']),
        node('cache', 'Redis Feed Cache', ['cache']),
        node('db', 'Cassandra', ['datastore']),
      ],
      [edge('lb', 'app'), edge('app', 'queue'), edge('queue', 'cache'), edge('app', 'db')],
      ['Push fan-out on write, hybrid pull for celebrity accounts'],
    );
    const r = runRubric(NEWS_FEED.rubric, g);
    expect(checkById(r.breakdown, 'queue-decouples-fanout').verdict).toBe('pass');
    expect(checkById(r.breakdown, 'feed-cache').verdict).toBe('pass');
    expect(checkById(r.breakdown, 'fanout-strategy').verdict).toBe('pass');
    expect(r.percent).toBeGreaterThan(70);
  });

  it('fails the fan-out-queue check when posts write synchronously with no queue', () => {
    const g = graph([node('app', 'API Server', ['appServer']), node('db', 'Cassandra', ['datastore'])], [edge('app', 'db')]);
    expect(checkById(runRubric(NEWS_FEED.rubric, g).breakdown, 'queue-decouples-fanout').verdict).toBe('fail');
  });

  it('fails the fan-out strategy check when push/pull/hybrid is never named', () => {
    const g = graph([node('app', 'API Server', ['appServer'])]);
    expect(checkById(runRubric(NEWS_FEED.rubric, g).breakdown, 'fanout-strategy').verdict).toBe('fail');
  });
});

describe('chat system HLD rubric', () => {
  it('scores a fully-wired design highly', () => {
    const g = graph(
      [
        node('lb', 'Load Balancer', ['loadBalancer']),
        node('gw', 'WebSocket Gateway', ['appServer']),
        node('broker', 'NATS Broker', ['queue']),
        node('db', 'Cassandra', ['datastore']),
      ],
      [edge('lb', 'gw'), edge('gw', 'broker'), edge('gw', 'db')],
      ['Presence via Redis heartbeat TTL', 'Offline messages stored and delivered as a push notification on reconnect'],
    );
    const r = runRubric(CHAT_SYSTEM.rubric, g);
    expect(checkById(r.breakdown, 'broker-routes-messages').verdict).toBe('pass');
    expect(checkById(r.breakdown, 'presence').verdict).toBe('pass');
    expect(checkById(r.breakdown, 'offline-delivery').verdict).toBe('pass');
    expect(r.percent).toBeGreaterThan(70);
  });

  it('fails presence and offline-delivery checks when neither is mentioned', () => {
    const g = graph([node('gw', 'Gateway', ['appServer']), node('db', 'Cassandra', ['datastore'])], [edge('gw', 'db')]);
    const r = runRubric(CHAT_SYSTEM.rubric, g);
    expect(checkById(r.breakdown, 'presence').verdict).toBe('fail');
    expect(checkById(r.breakdown, 'offline-delivery').verdict).toBe('fail');
  });

  it('gives only partial credit for a broker that is drawn but not wired to the gateway', () => {
    const g = graph([node('gw', 'Gateway', ['appServer']), node('broker', 'Kafka', ['queue'])]);
    expect(checkById(runRubric(CHAT_SYSTEM.rubric, g).breakdown, 'broker-routes-messages').verdict).toBe('partial');
  });
});
