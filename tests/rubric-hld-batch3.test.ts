import { describe, expect, it } from 'vitest';
import { runRubric } from '../shared/rubric/run.ts';
import type { RubricCheckResult } from '../shared/rubric/types.ts';
import type { SceneGraph } from '../shared/scene/types.ts';
import { PASTEBIN } from '../shared/hld/pastebin.ts';
import { UNIQUE_ID_GENERATOR } from '../shared/hld/unique-id-generator.ts';

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

describe('pastebin HLD rubric', () => {
  it('scores a fully-wired design highly', () => {
    const g = graph(
      [
        node('lb', 'Load Balancer', ['loadBalancer']),
        node('app', 'App Server', ['appServer']),
        node('meta', 'Postgres Metadata', ['datastore']),
      ],
      [edge('lb', 'app'), edge('app', 'meta')],
      ['Paste bodies stored in S3 object storage', 'Short ID via base62-encoded counter', 'TTL index expires old pastes'],
    );
    const r = runRubric(PASTEBIN.rubric, g);
    expect(checkById(r.breakdown, 'blob-storage-named').verdict).toBe('pass');
    expect(checkById(r.breakdown, 'id-strategy').verdict).toBe('pass');
    expect(checkById(r.breakdown, 'expiry-named').verdict).toBe('pass');
    expect(r.percent).toBeGreaterThan(70);
  });

  it('fails the blob-storage and expiry checks when neither is named', () => {
    const g = graph([node('app', 'App', ['appServer']), node('db', 'DB', ['datastore'])], [edge('app', 'db')]);
    const r = runRubric(PASTEBIN.rubric, g);
    expect(checkById(r.breakdown, 'blob-storage-named').verdict).toBe('fail');
    expect(checkById(r.breakdown, 'expiry-named').verdict).toBe('fail');
  });
});

describe('unique ID generator HLD rubric', () => {
  it('scores a fully-wired design highly', () => {
    const g = graph(
      [node('lb', 'Load Balancer', ['loadBalancer']), node('gen1', 'ID Generator', ['appServer']), node('gen2', 'ID Generator', ['appServer'])],
      [edge('lb', 'gen1'), edge('lb', 'gen2')],
      [
        'Snowflake-style: timestamp + machine ID + sequence',
        'NTP keeps clock skew in check',
        'IDs are roughly time-ordered',
        '64-bit ID with a 41-bit epoch timestamp',
      ],
    );
    const r = runRubric(UNIQUE_ID_GENERATOR.rubric, g);
    expect(checkById(r.breakdown, 'decentralized-strategy').verdict).toBe('pass');
    expect(checkById(r.breakdown, 'no-spof').verdict).toBe('pass');
    expect(checkById(r.breakdown, 'clock-handling').verdict).toBe('pass');
    expect(checkById(r.breakdown, 'sortable-ids').verdict).toBe('pass');
    expect(checkById(r.breakdown, 'bit-layout').verdict).toBe('pass');
    expect(r.percent).toBeGreaterThan(70);
  });

  it('fails the decentralized-strategy and no-spof checks for a single central generator', () => {
    const g = graph([node('gen', 'ID Generator (auto-increment)', ['appServer'])]);
    const r = runRubric(UNIQUE_ID_GENERATOR.rubric, g);
    expect(checkById(r.breakdown, 'decentralized-strategy').verdict).toBe('fail');
    expect(checkById(r.breakdown, 'no-spof').verdict).toBe('fail');
  });
});
