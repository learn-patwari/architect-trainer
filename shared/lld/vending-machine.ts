import { allNodesLabeled, edgeLabelMatches, hasDominantNode, hasRole, implementorCount, keywordAnywhere } from '../rubric/checks.ts';
import type { RubricSpec } from '../rubric/types.ts';
import type { DesignProblem } from '../types.ts';

/**
 * The canonical State-pattern LLD problem: the machine's behavior genuinely
 * differs by state, which is exactly what the abstraction/polymorphism checks
 * are built to reward.
 */

const RELATIONSHIP_KEYWORDS = ['extends', 'implements', 'has-a', 'has a', 'uses', 'aggregates', 'composes'];

const VENDING_MACHINE_RUBRIC: RubricSpec = {
  id: 'design-a-vending-machine',
  title: 'Design a Vending Machine — rubric',
  checks: [
    {
      id: 'has-abstraction',
      label: 'A machine-state interface/abstract class is present',
      max: 3,
      run: (g) =>
        hasRole(g, 'interface') || hasRole(g, 'abstractClass')
          ? { points: 3, verdict: 'pass', detail: 'A state abstraction is present.' }
          : { points: 0, verdict: 'fail', detail: 'Model the machine\'s behavior with the State pattern: a state interface/abstract class, rather than one class full of if/else on "what state am I in."' },
    },
    {
      id: 'polymorphism-used',
      label: 'At least two concrete states implement the abstraction',
      max: 3,
      run: (g) => {
        const n = implementorCount(g, ['interface', 'abstractClass']);
        if (n >= 2) return { points: 3, verdict: 'pass', detail: `${n} concrete states implement the abstraction.` };
        if (n === 1) return { points: 1, verdict: 'partial', detail: 'Only one state implements the abstraction — a state machine needs at least a couple of distinct states to be worth modeling this way.' };
        return { points: 0, verdict: 'fail', detail: 'No concrete state class is wired to (implements/extends) the state abstraction.' };
      },
    },
    {
      id: 'no-god-class',
      label: 'No single class does everything (a "god class")',
      max: 3,
      run: (g) =>
        hasDominantNode(g)
          ? { points: 0, verdict: 'fail', detail: 'One class accounts for a disproportionate share of the relationships here — a VendingMachine that implements every state\'s behavior directly is the shape this checks for.' }
          : { points: 3, verdict: 'pass', detail: 'Responsibilities look reasonably distributed across classes.' },
    },
    {
      id: 'enum-named',
      label: 'An enum models coins/denominations or product type',
      max: 2,
      run: (g) =>
        hasRole(g, 'enumType')
          ? { points: 2, verdict: 'pass', detail: 'An enum is named.' }
          : { points: 0, verdict: 'fail', detail: 'Accepted coin/note denominations are a small fixed set — model them as an enum.' },
    },
    {
      id: 'typed-relationships',
      label: 'Relationships between classes are typed, not generic arrows',
      max: 2,
      run: (g) =>
        edgeLabelMatches(g, RELATIONSHIP_KEYWORDS)
          ? { points: 2, verdict: 'pass', detail: 'At least one relationship is explicitly typed.' }
          : { points: 0, verdict: 'fail', detail: 'Label at least one arrow with what kind of relationship it is (implements, has-a, uses).' },
    },
    {
      id: 'inventory-named',
      label: 'Inventory/stock tracking is named',
      max: 2,
      run: (g) =>
        keywordAnywhere(g, ['inventory', 'stock', 'restock', 'quantity'])
          ? { points: 2, verdict: 'pass', detail: 'Inventory tracking is named.' }
          : { points: 0, verdict: 'fail', detail: 'Name what tracks each product\'s price and remaining quantity, and decrements it on a successful dispense.' },
    },
    {
      id: 'change-calculation',
      label: 'Change calculation is named as its own concern',
      max: 3,
      run: (g) =>
        keywordAnywhere(g, ['change calculation', 'make change', 'return change'])
          ? { points: 3, verdict: 'pass', detail: 'Change calculation is named.' }
          : { points: 0, verdict: 'fail', detail: 'Say how change is computed (inserted amount minus price, as a minimal set of coins) — this is easy to bury inside a state transition instead of pulling out cleanly.' },
    },
    {
      id: 'all-labeled',
      label: 'Every node is labeled',
      max: 2,
      run: (g) => {
        const { labeled, total } = allNodesLabeled(g);
        if (total === 0) return { points: 0, verdict: 'fail', detail: 'Nothing drawn yet.' };
        const points = Math.round((2 * labeled) / total);
        const verdict = labeled === total ? 'pass' : labeled === 0 ? 'fail' : 'partial';
        return { points, verdict, detail: labeled === total ? 'Every shape is labeled.' : `${total - labeled} shape(s) have no label.` };
      },
    },
  ],
};

const STATEMENT = `Design the class structure for a vending machine: a user selects a product, inserts money, and the machine dispenses the product and any change — or refunds if the selection is unavailable or insufficient money was inserted.

Functional requirements:
- Select a product.
- Insert coins/notes, possibly across multiple insertions.
- Dispense the product and correct change once enough money is inserted.
- Refuse (and refund) an unavailable selection or insufficient payment.
- Track remaining stock per product.

Design expectations:
- Model the machine's behavior as a state machine (e.g. idle, has money, dispensing, out of stock).
- Draw this as a class diagram: classes, interfaces, and typed relationships.`;

const REFERENCE_APPROACH = `Model the machine's behavior with the State pattern: a VendingMachineState interface with concrete states IdleState, HasMoneyState, DispensingState, and OutOfStockState, each implementing only the transitions valid from that state (selectProduct, insertCoin, dispense) — this avoids one giant class full of if/else on "what state am I in." An Inventory class tracks each product's price and remaining quantity, decrementing it on a successful dispense. A Coin (or Denomination) enum models the fixed set of accepted coin/note values. Change calculation — given the inserted amount and the product price, return the minimal set of coins for the difference — is its own method or class, not logic buried inside a state transition. The VendingMachine itself holds a reference to its current state and delegates behavior to it, rather than being a god class that implements every behavior directly for every state itself.`;

export const VENDING_MACHINE: DesignProblem = {
  slug: 'design-a-vending-machine',
  track: 'lld',
  title: 'Design a Vending Machine',
  difficulty: 'Medium',
  statement: STATEMENT,
  rubric: VENDING_MACHINE_RUBRIC,
  referenceApproach: REFERENCE_APPROACH,
  hints: [
    'The machine behaves completely differently depending on whether it\'s idle, has money inserted, or is out of stock. What pattern is built exactly for that?',
    'Where should "how much change to give back" actually live — inside a state transition, or somewhere else?',
    'Model each mode as its own class implementing a VendingMachineState interface (Idle/HasMoney/Dispensing/OutOfStock), and pull change calculation and inventory tracking out into their own classes.',
  ],
};
