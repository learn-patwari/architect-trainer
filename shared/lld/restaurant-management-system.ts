import { allNodesLabeled, edgeLabelMatches, hasDominantNode, hasRole, implementorCount, keywordAnywhere } from '../rubric/checks.ts';
import type { RubricSpec } from '../rubric/types.ts';
import type { DesignProblem } from '../types.ts';

/**
 * An Observer + State-pattern problem: the crux is decoupling "an order's
 * status changed" from "who needs to know" (kitchen display, waitstaff,
 * the bill) via Observer, layered on top of a per-order state machine —
 * distinct from movie-ticket-booking's seat-locking concurrency focus.
 */

const RELATIONSHIP_KEYWORDS = ['extends', 'implements', 'has-a', 'has a', 'uses', 'aggregates', 'composes'];

const RESTAURANT_MANAGEMENT_RUBRIC: RubricSpec = {
  id: 'design-a-restaurant-management-system',
  title: 'Design a Restaurant Management System — rubric',
  checks: [
    {
      id: 'has-abstraction',
      label: 'An order-state interface/abstract class is present',
      max: 3,
      run: (g) =>
        hasRole(g, 'interface') || hasRole(g, 'abstractClass')
          ? { points: 3, verdict: 'pass', detail: 'An order-state abstraction is present.' }
          : { points: 0, verdict: 'fail', detail: 'Model an order\'s lifecycle (placed, preparing, ready, served) with the State pattern, rather than a status field checked everywhere it matters.' },
    },
    {
      id: 'polymorphism-used',
      label: 'At least two order states implement the abstraction',
      max: 2,
      run: (g) => {
        const n = implementorCount(g, ['interface', 'abstractClass']);
        if (n >= 2) return { points: 2, verdict: 'pass', detail: `${n} concrete order states implement the abstraction.` };
        if (n === 1) return { points: 1, verdict: 'partial', detail: 'Only one state implements the abstraction.' };
        return { points: 0, verdict: 'fail', detail: 'No concrete order-state class is wired to (implements/extends) the abstraction.' };
      },
    },
    {
      id: 'observer-notification',
      label: 'An Observer relationship notifies interested parties of order-status changes',
      max: 3,
      run: (g) =>
        keywordAnywhere(g, ['observer', 'subscribe', 'notify'])
          ? { points: 3, verdict: 'pass', detail: 'Observer-style notification is named.' }
          : {
              points: 0,
              verdict: 'fail',
              detail: 'The kitchen display, waitstaff, and the bill all need to know when an order\'s status changes — name the Observer pattern (interested parties subscribe; the order notifies them) rather than each one polling or the Order class calling each directly by name.',
            },
    },
    {
      id: 'no-god-class',
      label: 'No single class does everything (a "god class")',
      max: 3,
      run: (g) =>
        hasDominantNode(g)
          ? { points: 0, verdict: 'fail', detail: 'One class accounts for a disproportionate share of the relationships here — an Order (or a RestaurantSystem) directly updating the kitchen display, waitstaff, and billing itself is the shape this checks for.' }
          : { points: 3, verdict: 'pass', detail: 'Responsibilities look reasonably distributed across classes.' },
    },
    {
      id: 'menu-item-modeled',
      label: 'Menu items and order line items are modeled separately',
      max: 2,
      run: (g) =>
        keywordAnywhere(g, ['menu item', 'line item', 'order item'])
          ? { points: 2, verdict: 'pass', detail: 'Menu/order-item modeling is named.' }
          : { points: 0, verdict: 'fail', detail: 'Keep a MenuItem (name, price) distinct from an OrderItem (a MenuItem plus quantity/modifications on a specific order).' },
    },
    {
      id: 'table-reservation',
      label: 'Table assignment/reservation is modeled as its own concern',
      max: 2,
      run: (g) =>
        keywordAnywhere(g, ['table', 'reservation', 'seating'])
          ? { points: 2, verdict: 'pass', detail: 'Table assignment is named.' }
          : { points: 0, verdict: 'fail', detail: 'Name how a table\'s availability and an order\'s association with a table are tracked, separate from the order\'s own contents.' },
    },
    {
      id: 'typed-relationships',
      label: 'Relationships between classes are typed, not generic arrows',
      max: 2,
      run: (g) =>
        edgeLabelMatches(g, RELATIONSHIP_KEYWORDS)
          ? { points: 2, verdict: 'pass', detail: 'At least one relationship is explicitly typed.' }
          : { points: 0, verdict: 'fail', detail: 'Label at least one arrow with what kind of relationship it is (implements, has-a, uses, observes).' },
    },
    {
      id: 'all-labeled',
      label: 'Every node is labeled',
      max: 3,
      run: (g) => {
        const { labeled, total } = allNodesLabeled(g);
        if (total === 0) return { points: 0, verdict: 'fail', detail: 'Nothing drawn yet.' };
        const points = Math.round((3 * labeled) / total);
        const verdict = labeled === total ? 'pass' : labeled === 0 ? 'fail' : 'partial';
        return { points, verdict, detail: labeled === total ? 'Every shape is labeled.' : `${total - labeled} shape(s) have no label.` };
      },
    },
  ],
};

const STATEMENT = `Design the class structure for a restaurant management system: a server takes an order at a table, the kitchen prepares it, and multiple parts of the restaurant (kitchen display, waitstaff, billing) need to react as the order's status changes.

Functional requirements:
- Take an order for a table, made up of one or more menu items with quantities.
- As the kitchen updates an order's status (placed -> preparing -> ready -> served), every interested party (the kitchen display, the assigned server, the eventual bill) reflects the current status without polling.
- Generate a bill from a table's completed order(s).

Design expectations:
- Draw this as a class diagram: classes, interfaces, and typed relationships — not an infrastructure diagram.`;

const REFERENCE_APPROACH = `An order's lifecycle is modeled with the State pattern: an OrderState interface with concrete states PlacedState, PreparingState, ReadyState, and ServedState, each defining what transitions are valid from that point — this keeps "what can happen next" attached to the state itself rather than scattered across conditionals on a status field. Because several independent parts of the system (a kitchen-display class, a waitstaff-notification class, and eventually billing) all need to react to an order's status changing, the Order uses the Observer pattern: interested parties implement an OrderObserver interface and subscribe to a specific Order, which notifies all of its subscribers on every state transition — this decouples Order from needing to know the concrete list of who cares about it, so adding a new kind of observer (a customer-facing order-tracking screen) doesn't require changing Order at all. A MenuItem (name, price, category) is modeled separately from an OrderItem (a reference to a MenuItem plus a quantity and any modifications, e.g. "no onions") on a specific Order, since a menu item's definition and one instance of it being ordered are different things with different lifecycles. A Table tracks its own availability/reservation status, referenced by an Order rather than duplicating table state onto the order itself. Generating a bill sums the OrderItems across a table's order(s) using each MenuItem's price — a Bill class that reads from Order and Table rather than Order needing to know how to render or total a bill itself.`;

export const RESTAURANT_MANAGEMENT_SYSTEM: DesignProblem = {
  slug: 'design-a-restaurant-management-system',
  track: 'lld',
  title: 'Design a Restaurant Management System',
  difficulty: 'Medium',
  statement: STATEMENT,
  rubric: RESTAURANT_MANAGEMENT_RUBRIC,
  referenceApproach: REFERENCE_APPROACH,
  hints: [
    'The kitchen display, the waitstaff, and eventually billing all need to know the instant an order\'s status changes. Should Order call each of them by name directly, or is there a pattern built exactly for "notify whoever\'s interested"?',
    'An order moves through fixed phases (placed, preparing, ready, served) with different valid next-steps in each. What pattern models that lifecycle cleanly?',
    'Use the Observer pattern so interested parties subscribe to an Order\'s status changes instead of being called by name, and use the State pattern for the order\'s own placed/preparing/ready/served lifecycle.',
  ],
};
