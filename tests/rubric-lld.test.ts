import { describe, expect, it } from 'vitest';
import { runRubric } from '../shared/rubric/run.ts';
import type { RubricCheckResult } from '../shared/rubric/types.ts';
import type { SceneGraph } from '../shared/scene/types.ts';
import { PARKING_LOT } from '../shared/lld/parking-lot.ts';
import { RATE_LIMITER } from '../shared/lld/rate-limiter.ts';

function node(id: string, label: string, roles: SceneGraph['nodes'][number]['roles'] = []): SceneGraph['nodes'][number] {
  return { id, label, roles, x: 0, y: 0, width: 100, height: 60 };
}
function edge(from: string, to: string, label: string | null = null): SceneGraph['edges'][number] {
  return { id: `${from}-${to}`, from, to, label };
}
function graph(nodes: SceneGraph['nodes'], edges: SceneGraph['edges'] = [], extraText: string[] = []): SceneGraph {
  return { nodes, edges, allText: [...nodes.map((n) => n.label), ...edges.map((e) => e.label ?? '').filter(Boolean), ...extraText] };
}
function checkById(breakdown: RubricCheckResult[], id: string): RubricCheckResult {
  return breakdown.find((c) => c.id === id)!;
}

describe('parking lot LLD rubric', () => {
  it('scores a well-formed class diagram highly across every check', () => {
    const g = graph(
      [
        node('iface', 'Vehicle Interface', ['interface']),
        node('car', 'Car'),
        node('moto', 'Motorcycle'),
        node('spotType', 'SpotType Enum', ['enumType']),
        node('lot', 'ParkingLot'),
        node('pricing', 'PricingStrategy'),
      ],
      [edge('car', 'iface', 'implements'), edge('moto', 'iface', 'implements'), edge('lot', 'car', 'has-a')],
    );
    const r = runRubric(PARKING_LOT.rubric, g);
    expect(checkById(r.breakdown, 'has-abstraction').verdict).toBe('pass');
    expect(checkById(r.breakdown, 'polymorphism-used').verdict).toBe('pass');
    expect(checkById(r.breakdown, 'no-god-class').verdict).toBe('pass');
    expect(checkById(r.breakdown, 'enum-named').verdict).toBe('pass');
    expect(checkById(r.breakdown, 'typed-relationships').verdict).toBe('pass');
    expect(checkById(r.breakdown, 'orchestrator-present').verdict).toBe('pass');
    expect(r.percent).toBeGreaterThan(70);
  });

  it('fails the abstraction check when there is no interface or abstract class', () => {
    const g = graph([node('car', 'Car'), node('lot', 'ParkingLot')], [edge('lot', 'car', 'has-a')]);
    expect(checkById(runRubric(PARKING_LOT.rubric, g).breakdown, 'has-abstraction').verdict).toBe('fail');
  });

  it('gives only partial credit when just one class implements the abstraction', () => {
    const g = graph([node('iface', 'Vehicle', ['interface']), node('car', 'Car')], [edge('car', 'iface', 'implements')]);
    expect(checkById(runRubric(PARKING_LOT.rubric, g).breakdown, 'polymorphism-used').verdict).toBe('partial');
  });

  it('flags a god class when one class touches most relationships in the diagram', () => {
    const g = graph(
      [node('lot', 'ParkingLot'), node('car', 'Car'), node('spot', 'Spot'), node('ticket', 'Ticket'), node('pricing', 'Pricing')],
      [edge('lot', 'car'), edge('lot', 'spot'), edge('lot', 'ticket'), edge('lot', 'pricing')],
    );
    expect(checkById(runRubric(PARKING_LOT.rubric, g).breakdown, 'no-god-class').verdict).toBe('fail');
  });

  it('requires the fee/pricing concept to be named explicitly', () => {
    const g = graph([node('car', 'Car'), node('lot', 'ParkingLot')]);
    expect(checkById(runRubric(PARKING_LOT.rubric, g).breakdown, 'pricing-named').verdict).toBe('fail');
    const withPricing = graph([node('car', 'Car'), node('lot', 'ParkingLot')], [], ['Fee calculated on exit']);
    expect(checkById(runRubric(PARKING_LOT.rubric, withPricing).breakdown, 'pricing-named').verdict).toBe('pass');
  });
});

describe('rate limiter LLD rubric', () => {
  it('scores a well-formed design highly', () => {
    const g = graph(
      [
        node('iface', 'RateLimiter Interface', ['interface']),
        node('token', 'TokenBucketRateLimiter'),
        node('window', 'SlidingWindowRateLimiter'),
        node('store', 'Store'),
        node('factory', 'RateLimiterFactory'),
      ],
      [edge('token', 'iface', 'implements'), edge('window', 'iface', 'implements'), edge('token', 'store', 'uses')],
      ['Store.increment is atomic (synchronized / Lua script) to stay thread-safe under concurrent access'],
    );
    const r = runRubric(RATE_LIMITER.rubric, g);
    expect(checkById(r.breakdown, 'has-abstraction').verdict).toBe('pass');
    expect(checkById(r.breakdown, 'multiple-algorithms').verdict).toBe('pass');
    expect(checkById(r.breakdown, 'storage-abstracted').verdict).toBe('pass');
    expect(checkById(r.breakdown, 'concurrency-named').verdict).toBe('pass');
    expect(checkById(r.breakdown, 'factory-named').verdict).toBe('pass');
    expect(r.percent).toBeGreaterThan(70);
  });

  it('fails the concurrency check when thread-safety is never mentioned', () => {
    const g = graph([node('iface', 'RateLimiter', ['interface']), node('token', 'TokenBucket')], [edge('token', 'iface', 'implements')]);
    expect(checkById(runRubric(RATE_LIMITER.rubric, g).breakdown, 'concurrency-named').verdict).toBe('fail');
  });

  it('fails the storage-abstraction check when there is no separate store/backend concept', () => {
    const g = graph([node('iface', 'RateLimiter', ['interface']), node('token', 'TokenBucket')], [edge('token', 'iface', 'implements')]);
    expect(checkById(runRubric(RATE_LIMITER.rubric, g).breakdown, 'storage-abstracted').verdict).toBe('fail');
  });
});
