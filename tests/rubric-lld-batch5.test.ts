import { describe, expect, it } from 'vitest';
import { runRubric } from '../shared/rubric/run.ts';
import type { RubricCheckResult } from '../shared/rubric/types.ts';
import type { SceneGraph } from '../shared/scene/types.ts';
import { BLACKJACK_GAME } from '../shared/lld/blackjack-game.ts';
import { GROCERY_STORE_SYSTEM } from '../shared/lld/grocery-store-system.ts';
import { RESTAURANT_MANAGEMENT_SYSTEM } from '../shared/lld/restaurant-management-system.ts';
import { SHIPPING_LOCKER_SYSTEM } from '../shared/lld/shipping-locker-system.ts';

function node(id: string, label: string, roles: SceneGraph['nodes'][number]['roles']): SceneGraph['nodes'][number] {
  return { id, label, roles, x: 0, y: 0, width: 100, height: 60 };
}
function edge(from: string, to: string, label: string | null = null): SceneGraph['edges'][number] {
  return { id: `${from}-${to}`, from, to, label };
}
function graph(nodes: SceneGraph['nodes'], edges: SceneGraph['edges'] = [], extraText: string[] = []): SceneGraph {
  return { nodes, edges, allText: [...nodes.map((n) => n.label), ...extraText] };
}
function checkById(breakdown: RubricCheckResult[], id: string): RubricCheckResult {
  return breakdown.find((c) => c.id === id)!;
}

describe('grocery store system LLD rubric', () => {
  it('scores a fully-wired design highly', () => {
    const g = graph(
      [
        node('rule', 'DiscountRule', ['interface']),
        node('pct', 'PercentageOffRule', []),
        node('bogo', 'BuyOneGetOneRule', []),
      ],
      [edge('pct', 'rule', 'implements'), edge('bogo', 'rule', 'implements')],
      ['Cart holds line items', 'Inventory quantity on hand decremented on checkout', 'Atomic transaction commits payment and inventory together'],
    );
    const r = runRubric(GROCERY_STORE_SYSTEM.rubric, g);
    expect(checkById(r.breakdown, 'has-abstraction').verdict).toBe('pass');
    expect(checkById(r.breakdown, 'polymorphism-used').verdict).toBe('pass');
    expect(checkById(r.breakdown, 'atomic-checkout').verdict).toBe('pass');
    expect(r.percent).toBeGreaterThan(70);
  });

  it('fails has-abstraction when no interface/abstract class is present', () => {
    const g = graph([node('checkout', 'Checkout', [])]);
    const r = runRubric(GROCERY_STORE_SYSTEM.rubric, g);
    expect(checkById(r.breakdown, 'has-abstraction').verdict).toBe('fail');
  });
});

describe('blackjack game LLD rubric', () => {
  it('scores a fully-wired design highly', () => {
    const g = graph(
      [node('state', 'RoundState', ['interface']), node('player', 'PlayerTurnState', []), node('dealer', 'DealerTurnState', [])],
      [edge('player', 'state', 'implements'), edge('dealer', 'state', 'implements')],
      ['Hand value calculation handles the Ace as 1 or 11 without busting', 'Dealer strategy: hit below 17, stand otherwise', 'Deck shuffles and deals cards'],
    );
    const r = runRubric(BLACKJACK_GAME.rubric, g);
    expect(checkById(r.breakdown, 'has-abstraction').verdict).toBe('pass');
    expect(checkById(r.breakdown, 'hand-value-separate').verdict).toBe('pass');
    expect(checkById(r.breakdown, 'dealer-strategy').verdict).toBe('pass');
    expect(r.percent).toBeGreaterThan(70);
  });

  it('fails has-abstraction and hand-value checks when neither is present', () => {
    const g = graph([node('game', 'Game', [])]);
    const r = runRubric(BLACKJACK_GAME.rubric, g);
    expect(checkById(r.breakdown, 'has-abstraction').verdict).toBe('fail');
    expect(checkById(r.breakdown, 'hand-value-separate').verdict).toBe('fail');
  });
});

describe('shipping locker system LLD rubric', () => {
  it('scores a fully-wired design highly', () => {
    const g = graph(
      [node('state', 'LockerState', ['interface']), node('free', 'FreeState', []), node('occupied', 'OccupiedState', [])],
      [edge('free', 'state', 'implements'), edge('occupied', 'state', 'implements')],
      ['Best-fit allocation strategy picks the smallest available locker', 'Pickup code verifies the recipient', 'Uncollected package expires and the locker is reclaimed'],
    );
    const r = runRubric(SHIPPING_LOCKER_SYSTEM.rubric, g);
    expect(checkById(r.breakdown, 'has-abstraction').verdict).toBe('pass');
    expect(checkById(r.breakdown, 'sizing-strategy').verdict).toBe('pass');
    expect(checkById(r.breakdown, 'pickup-code').verdict).toBe('pass');
    expect(r.percent).toBeGreaterThan(70);
  });

  it('fails sizing-strategy and pickup-code checks when neither is named', () => {
    const g = graph([node('locker', 'Locker', [])]);
    const r = runRubric(SHIPPING_LOCKER_SYSTEM.rubric, g);
    expect(checkById(r.breakdown, 'sizing-strategy').verdict).toBe('fail');
    expect(checkById(r.breakdown, 'pickup-code').verdict).toBe('fail');
  });
});

describe('restaurant management system LLD rubric', () => {
  it('scores a fully-wired design highly', () => {
    const g = graph(
      [node('state', 'OrderState', ['interface']), node('placed', 'PlacedState', []), node('preparing', 'PreparingState', [])],
      [edge('placed', 'state', 'implements'), edge('preparing', 'state', 'implements')],
      ['Observer pattern notifies the kitchen display and waitstaff on status change', 'Menu item and order line item modeled separately', 'Table reservation tracked separately from the order'],
    );
    const r = runRubric(RESTAURANT_MANAGEMENT_SYSTEM.rubric, g);
    expect(checkById(r.breakdown, 'has-abstraction').verdict).toBe('pass');
    expect(checkById(r.breakdown, 'observer-notification').verdict).toBe('pass');
    expect(r.percent).toBeGreaterThan(70);
  });

  it('fails observer-notification when nothing is named', () => {
    const g = graph([node('order', 'Order', [])]);
    const r = runRubric(RESTAURANT_MANAGEMENT_SYSTEM.rubric, g);
    expect(checkById(r.breakdown, 'observer-notification').verdict).toBe('fail');
  });
});
