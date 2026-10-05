import { describe, expect, it } from 'vitest';
import { runRubric } from '../shared/rubric/run.ts';
import type { RubricCheckResult } from '../shared/rubric/types.ts';
import type { Role, SceneGraph } from '../shared/scene/types.ts';
import { URL_SHORTENER } from '../shared/hld/url-shortener.ts';

function node(id: string, label: string, roles: Role[]): SceneGraph['nodes'][number] {
  return { id, label, roles, x: 0, y: 0, width: 100, height: 60 };
}
function edge(from: string, to: string, label: string | null = null): SceneGraph['edges'][number] {
  return { id: `${from}-${to}`, from, to, label };
}
function graph(nodes: SceneGraph['nodes'], edges: SceneGraph['edges'] = [], extraText: string[] = []): SceneGraph {
  return {
    nodes,
    edges,
    allText: [...nodes.map((n) => n.label), ...edges.map((e) => e.label ?? '').filter(Boolean), ...extraText],
  };
}
function checkById(breakdown: RubricCheckResult[], id: string): RubricCheckResult {
  return breakdown.find((c) => c.id === id)!;
}

describe('url-shortener rubric', () => {
  it('scores a solid, fully-wired design highly across every applicable check', () => {
    const g = graph(
      [
        node('lb', 'Load Balancer', ['loadBalancer']),
        node('app', 'API Server', ['appServer']),
        node('cache', 'Redis Cache', ['cache']),
        node('db', 'DynamoDB', ['datastore']),
      ],
      [edge('lb', 'app'), edge('app', 'cache'), edge('cache', 'db')],
      ['Short codes: base62-encoded counter'],
    );
    const r = runRubric(URL_SHORTENER.rubric, g);
    expect(checkById(r.breakdown, 'load-balancer').verdict).toBe('pass');
    expect(checkById(r.breakdown, 'app-tier').verdict).toBe('pass');
    expect(checkById(r.breakdown, 'datastore-named').verdict).toBe('pass');
    expect(checkById(r.breakdown, 'cache-on-read-path').verdict).toBe('pass');
    expect(checkById(r.breakdown, 'id-strategy').verdict).toBe('pass');
    expect(checkById(r.breakdown, 'all-labeled').verdict).toBe('pass');
    expect(checkById(r.breakdown, 'shard-key').verdict).toBe('na'); // only one datastore node
    expect(r.percent).toBeGreaterThan(70);
  });

  it('fails the load balancer check when none is drawn', () => {
    const g = graph([node('app', 'API Server', ['appServer']), node('db', 'Postgres', ['datastore'])], [edge('app', 'db')]);
    const c = checkById(runRubric(URL_SHORTENER.rubric, g).breakdown, 'load-balancer');
    expect(c.verdict).toBe('fail');
    expect(c.points).toBe(0);
  });

  it('gives partial credit for a load balancer drawn but not wired into the app tier', () => {
    const g = graph([node('lb', 'Load Balancer', ['loadBalancer']), node('app', 'API Server', ['appServer'])], []);
    expect(checkById(runRubric(URL_SHORTENER.rubric, g).breakdown, 'load-balancer').verdict).toBe('partial');
  });

  it('gives only partial credit when the cache is wired downstream of the datastore instead of between it and the app tier', () => {
    const g = graph(
      [node('app', 'API Server', ['appServer']), node('db', 'Postgres', ['datastore']), node('cache', 'Redis', ['cache'])],
      [edge('app', 'db'), edge('db', 'cache')], // cache sits after the datastore, not on the read path
    );
    expect(checkById(runRubric(URL_SHORTENER.rubric, g).breakdown, 'cache-on-read-path').verdict).toBe('partial');
  });

  it('passes the cache check when it sits between the app tier and the datastore', () => {
    const g = graph(
      [node('app', 'API Server', ['appServer']), node('cache', 'Redis', ['cache']), node('db', 'Postgres', ['datastore'])],
      [edge('app', 'cache'), edge('cache', 'db')],
    );
    expect(checkById(runRubric(URL_SHORTENER.rubric, g).breakdown, 'cache-on-read-path').verdict).toBe('pass');
  });

  it('flags a single point of failure when every tier has exactly one instance', () => {
    const g = graph(
      [node('lb', 'Load Balancer', ['loadBalancer']), node('app', 'API Server', ['appServer']), node('db', 'Postgres', ['datastore'])],
      [edge('lb', 'app'), edge('app', 'db')],
    );
    const c = checkById(runRubric(URL_SHORTENER.rubric, g).breakdown, 'no-spof');
    expect(c.verdict).toBe('fail');
    expect(c.points).toBe(0);
  });

  it('gives partial redundancy credit when only one tier shows evidence of it', () => {
    const g = graph(
      [
        node('lb1', 'Load Balancer', ['loadBalancer']),
        node('lb2', 'Load Balancer', ['loadBalancer']),
        node('app', 'API Server', ['appServer']),
        node('db', 'Postgres', ['datastore']),
      ],
      [edge('lb1', 'app'), edge('app', 'db')],
    );
    const c = checkById(runRubric(URL_SHORTENER.rubric, g).breakdown, 'no-spof');
    expect(c.points).toBe(1);
    expect(c.verdict).toBe('partial');
  });

  it('flags an unlabeled node and gives partial credit for the labeling check', () => {
    const g = graph([node('lb', '', ['loadBalancer']), node('app', 'API Server', ['appServer'])]);
    const c = checkById(runRubric(URL_SHORTENER.rubric, g).breakdown, 'all-labeled');
    expect(c.verdict).toBe('partial');
    expect(c.points).toBe(1);
  });

  it('matches a specific datastore technology even when its label wraps onto multiple lines', () => {
    // Wrapping breaks at word boundaries (as Excalidraw's does), not mid-word — the keyword
    // itself ("dynamodb") stays intact on one line even though the label as a whole wraps.
    const g = graph([node('app', 'API Server', ['appServer']), node('db', 'Amazon\nDynamoDB', ['datastore'])], [edge('app', 'db')]);
    expect(checkById(runRubric(URL_SHORTENER.rubric, g).breakdown, 'datastore-named').verdict).toBe('pass');
  });

  it('requires a shard key only once a second datastore node appears, then checks for it', () => {
    const oneStore = graph([node('db', 'Postgres', ['datastore'])]);
    expect(checkById(runRubric(URL_SHORTENER.rubric, oneStore).breakdown, 'shard-key').verdict).toBe('na');

    const twoStoresNoKey = graph([node('db1', 'Postgres shard 1', ['datastore']), node('db2', 'Postgres shard 2', ['datastore'])]);
    expect(checkById(runRubric(URL_SHORTENER.rubric, twoStoresNoKey).breakdown, 'shard-key').verdict).toBe('fail');

    const twoStoresWithKey = graph(
      [node('db1', 'Postgres shard 1', ['datastore']), node('db2', 'Postgres shard 2', ['datastore'])],
      [],
      ['Sharded by hash of the short code (shard key: code)'],
    );
    expect(checkById(runRubric(URL_SHORTENER.rubric, twoStoresWithKey).breakdown, 'shard-key').verdict).toBe('pass');
  });

  it('gives partial credit for a datastore labeled only "Database" instead of a real technology', () => {
    const g = graph([node('app', 'API Server', ['appServer']), node('db', 'Database', ['datastore'])], [edge('app', 'db')]);
    expect(checkById(runRubric(URL_SHORTENER.rubric, g).breakdown, 'datastore-named').verdict).toBe('partial');
  });

  it('scores an empty scene at zero, with every check failing or n/a', () => {
    const r = runRubric(URL_SHORTENER.rubric, graph([]));
    expect(r.score).toBe(0);
    expect(r.percent).toBe(0);
  });
});
