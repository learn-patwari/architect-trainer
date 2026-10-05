import { allNodesLabeled, edgeLabelMatches, hasDominantNode, hasRole, implementorCount, keywordAnywhere } from '../rubric/checks.ts';
import type { RubricSpec } from '../rubric/types.ts';
import type { DesignProblem } from '../types.ts';

/**
 * A checkout/inventory entity-modeling problem: the crux is a Strategy seam
 * for pricing/discounts (percentage off, BOGO, coupon) plus inventory that
 * must be decremented atomically at checkout — a different flavor of
 * "pluggable rule" than the rate limiter's algorithm-swap.
 */

const RELATIONSHIP_KEYWORDS = ['extends', 'implements', 'has-a', 'has a', 'uses', 'aggregates', 'composes'];

const GROCERY_STORE_RUBRIC: RubricSpec = {
  id: 'design-a-grocery-store-system',
  title: 'Design a Grocery Store System — rubric',
  checks: [
    {
      id: 'has-abstraction',
      label: 'A pricing/discount-rule interface or abstract class is present',
      max: 3,
      run: (g) =>
        hasRole(g, 'interface') || hasRole(g, 'abstractClass')
          ? { points: 3, verdict: 'pass', detail: 'A discount-rule abstraction is present.' }
          : { points: 0, verdict: 'fail', detail: 'Model discount rules (percentage off, buy-one-get-one, coupon) behind one interface, so checkout applies whichever rules are active without branching on their type.' },
    },
    {
      id: 'polymorphism-used',
      label: 'At least two discount rules implement the abstraction',
      max: 3,
      run: (g) => {
        const n = implementorCount(g, ['interface', 'abstractClass']);
        if (n >= 2) return { points: 3, verdict: 'pass', detail: `${n} concrete discount rules implement the abstraction.` };
        if (n === 1) return { points: 1, verdict: 'partial', detail: 'Only one discount rule implements the abstraction — with just one, the interface isn\'t earning its keep yet.' };
        return { points: 0, verdict: 'fail', detail: 'No concrete discount rule is wired to (implements/extends) the abstraction.' };
      },
    },
    {
      id: 'no-god-class',
      label: 'No single class does everything (a "god class")',
      max: 3,
      run: (g) =>
        hasDominantNode(g)
          ? { points: 0, verdict: 'fail', detail: 'One class accounts for a disproportionate share of the relationships here — a Checkout class computing every discount type itself, inline, is the shape this checks for.' }
          : { points: 3, verdict: 'pass', detail: 'Responsibilities look reasonably distributed across classes.' },
    },
    {
      id: 'inventory-tracking',
      label: 'Inventory/stock is tracked and decremented on checkout',
      max: 3,
      run: (g) =>
        keywordAnywhere(g, ['inventory', 'stock', 'quantity on hand', 'decrement'])
          ? { points: 3, verdict: 'pass', detail: 'Inventory tracking is named.' }
          : { points: 0, verdict: 'fail', detail: 'Name what tracks each product\'s remaining quantity, and how it\'s decremented once a checkout actually completes (not when an item is merely scanned).' },
    },
    {
      id: 'atomic-checkout',
      label: 'A checkout completes atomically (payment and inventory both commit, or neither does)',
      max: 3,
      run: (g) =>
        keywordAnywhere(g, ['atomic', 'transaction', 'rollback'])
          ? { points: 3, verdict: 'pass', detail: 'Atomic checkout is named.' }
          : {
              points: 0,
              verdict: 'fail',
              detail: 'If payment succeeds but inventory decrement fails (or vice versa), the store\'s books are wrong — name that a checkout commits both together, or rolls both back.',
            },
    },
    {
      id: 'cart-modeled',
      label: 'A cart aggregates line items separately from the catalog/product',
      max: 2,
      run: (g) =>
        keywordAnywhere(g, ['cart', 'line item', 'shopping cart'])
          ? { points: 2, verdict: 'pass', detail: 'A cart/line-item model is named.' }
          : { points: 0, verdict: 'fail', detail: 'Model a cart holding line items (product + quantity) separately from the product catalog itself.' },
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

const STATEMENT = `Design the class structure for a grocery store's point-of-sale system: customers add products to a cart, apply discounts, and check out, while inventory stays accurate.

Functional requirements:
- Add products (by scanning or lookup) to a cart, with quantities.
- Apply one or more discount rules at checkout (a percentage off, buy-one-get-one, a coupon code) — support adding a new discount type later without rewriting checkout.
- Checkout charges the total and decrements inventory for every purchased item — both must succeed together, or neither should apply.

Design expectations:
- Draw this as a class diagram: classes, interfaces, and typed relationships — not an infrastructure diagram.`;

const REFERENCE_APPROACH = `Discount rules are modeled behind a DiscountRule interface (a single method like apply(cart): Money), with concrete classes PercentageOffRule, BuyOneGetOneRule, and CouponRule each implementing it — checkout applies whatever active rules exist by iterating and calling apply() polymorphically, rather than branching on discount type inline, which is exactly what lets a new discount type be added later without touching Checkout at all. A Cart holds a list of LineItem (a Product reference plus a quantity), kept separate from the Product/catalog model itself, since a cart's contents and a store's catalog have different lifetimes and responsibilities. An Inventory class tracks each product's quantity on hand and is decremented only at the point checkout actually commits — not when an item is merely added to the cart, since an abandoned cart shouldn't have reserved inventory forever. The Checkout class ties this together but delegates rather than doing everything itself: it asks Inventory to reserve/decrement stock and a Payment collaborator to charge the customer, and both must succeed together as a single logical transaction — if payment fails after inventory was already decremented (or vice versa), that decrement/charge is rolled back, so the store's books and stock counts never drift out of sync with what customers actually paid for.`;

export const GROCERY_STORE_SYSTEM: DesignProblem = {
  slug: 'design-a-grocery-store-system',
  track: 'lld',
  title: 'Design a Grocery Store System',
  difficulty: 'Medium',
  statement: STATEMENT,
  rubric: GROCERY_STORE_RUBRIC,
  referenceApproach: REFERENCE_APPROACH,
  hints: [
    'The prompt wants new discount types addable later without rewriting checkout. What pattern is built exactly for "a family of interchangeable rules behind one interface"?',
    'If payment succeeds but decrementing inventory fails right after, what state is the store left in? What has to be true about those two steps together?',
    'Model discounts as a DiscountRule interface with multiple implementations, keep a Cart of line items separate from the product catalog, and commit payment + inventory decrement as a single atomic step at checkout.',
  ],
};
