import { allNodesLabeled, edgeLabelMatches, hasDominantNode, hasRole, implementorCount, keywordAnywhere } from '../rubric/checks.ts';
import type { RubricSpec } from '../rubric/types.ts';
import type { DesignProblem } from '../types.ts';

/**
 * An allocation-strategy + State-pattern problem: the crux is a pluggable
 * "which locker size fits this package" strategy, plus a per-locker state
 * machine (free/reserved/occupied/expired) — a smaller-scope cousin of the
 * parking lot problem, with a code-based pickup flow instead of a gate.
 */

const RELATIONSHIP_KEYWORDS = ['extends', 'implements', 'has-a', 'has a', 'uses', 'aggregates', 'composes'];

const SHIPPING_LOCKER_RUBRIC: RubricSpec = {
  id: 'design-a-shipping-locker-system',
  title: 'Design a Shipping Locker System — rubric',
  checks: [
    {
      id: 'has-abstraction',
      label: 'A locker-state interface/abstract class is present',
      max: 3,
      run: (g) =>
        hasRole(g, 'interface') || hasRole(g, 'abstractClass')
          ? { points: 3, verdict: 'pass', detail: 'A locker-state abstraction is present.' }
          : { points: 0, verdict: 'fail', detail: 'Model a locker\'s lifecycle (free, reserved, occupied, expired) with the State pattern, rather than a status enum with behavior scattered in if/else around it.' },
    },
    {
      id: 'polymorphism-used',
      label: 'At least two locker states implement the abstraction',
      max: 3,
      run: (g) => {
        const n = implementorCount(g, ['interface', 'abstractClass']);
        if (n >= 2) return { points: 3, verdict: 'pass', detail: `${n} concrete locker states implement the abstraction.` };
        if (n === 1) return { points: 1, verdict: 'partial', detail: 'Only one state implements the abstraction — a locker\'s lifecycle needs at least a couple of distinct states to be worth modeling this way.' };
        return { points: 0, verdict: 'fail', detail: 'No concrete locker-state class is wired to (implements/extends) the abstraction.' };
      },
    },
    {
      id: 'no-god-class',
      label: 'No single class does everything (a "god class")',
      max: 3,
      run: (g) =>
        hasDominantNode(g)
          ? { points: 0, verdict: 'fail', detail: 'One class accounts for a disproportionate share of the relationships here — a LockerSystem doing allocation, state transitions, and code verification all itself is the shape this checks for.' }
          : { points: 3, verdict: 'pass', detail: 'Responsibilities look reasonably distributed across classes.' },
    },
    {
      id: 'sizing-strategy',
      label: 'Locker-size allocation is a pluggable strategy, not hard-coded',
      max: 3,
      run: (g) =>
        keywordAnywhere(g, ['size strategy', 'allocation strategy', 'best-fit', 'smallest fit'])
          ? { points: 3, verdict: 'pass', detail: 'A sizing/allocation strategy is named.' }
          : {
              points: 0,
              verdict: 'fail',
              detail: 'Name how the system decides which locker a package goes into — a best-fit strategy (smallest available locker the package fits in) that could be swapped for a different allocation rule.',
            },
    },
    {
      id: 'pickup-code',
      label: 'A pickup-code mechanism verifies the right person opens the locker',
      max: 3,
      run: (g) =>
        keywordAnywhere(g, ['pickup code', 'access code', 'verification code'])
          ? { points: 3, verdict: 'pass', detail: 'A pickup-code mechanism is named.' }
          : { points: 0, verdict: 'fail', detail: 'Name how the system verifies the right recipient opens a specific locker (a generated pickup code checked against the reservation).' },
    },
    {
      id: 'expiry-handling',
      label: 'An uncollected package eventually expires/escalates',
      max: 2,
      run: (g) =>
        keywordAnywhere(g, ['expire', 'expiry', 'ttl', 'uncollected'])
          ? { points: 2, verdict: 'pass', detail: 'Expiry handling is named.' }
          : { points: 0, verdict: 'fail', detail: 'Say what happens if a package is never picked up — an expiry after which the locker is reclaimed (and the package returned/re-routed).' },
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
      max: 1,
      run: (g) => {
        const { labeled, total } = allNodesLabeled(g);
        if (total === 0) return { points: 0, verdict: 'fail', detail: 'Nothing drawn yet.' };
        const points = Math.round((1 * labeled) / total);
        const verdict = labeled === total ? 'pass' : labeled === 0 ? 'fail' : 'partial';
        return { points, verdict, detail: labeled === total ? 'Every shape is labeled.' : `${total - labeled} shape(s) have no label.` };
      },
    },
  ],
};

const STATEMENT = `Design the class structure for a package-locker system (like an Amazon Locker): a delivery is assigned to a locker of appropriate size, the recipient gets a pickup code, and the locker is freed once collected.

Functional requirements:
- assignLocker(package) reserves the smallest available locker the package fits in, and issues a pickup code.
- verifyPickup(lockerId, code) opens the locker only if the code matches, then frees the locker.
- A package uncollected past a deadline eventually expires (the locker is reclaimed).

Design expectations:
- Draw this as a class diagram: classes, interfaces, and typed relationships — not an infrastructure diagram.`;

const REFERENCE_APPROACH = `Each locker's lifecycle is modeled with the State pattern: a LockerState interface with concrete states FreeState, ReservedState (a package assigned, awaiting drop-off), OccupiedState (holding a package, awaiting pickup), and ExpiredState, each defining which transitions are valid from that state — this keeps the lifecycle's rules in one place per state rather than scattered across conditionals checking a status field. Locker-size selection is pulled out into its own LockerAllocationStrategy interface (with a BestFitStrategy default implementation: the smallest available locker the package still fits in), so the allocation rule can be swapped later (e.g. for a rule that also considers locker location) without touching the rest of the system. Assigning a locker generates a pickup code, stored against that specific reservation; verifyPickup checks the supplied code against the reservation for that locker before transitioning it to free and physically unlocking it — a mismatched code is simply rejected, with no transition. A package that stays in OccupiedState past a configured deadline transitions to ExpiredState, at which point the locker is reclaimed for new reservations and the package is flagged for return or re-routing, rather than sitting reserved indefinitely. The LockerSystem itself coordinates these pieces (find a locker via the strategy, transition its state, verify a code on pickup) without implementing allocation logic or state-transition rules directly inside itself.`;

export const SHIPPING_LOCKER_SYSTEM: DesignProblem = {
  slug: 'design-a-shipping-locker-system',
  track: 'lld',
  title: 'Design a Shipping Locker System',
  difficulty: 'Medium',
  statement: STATEMENT,
  rubric: SHIPPING_LOCKER_RUBRIC,
  referenceApproach: REFERENCE_APPROACH,
  hints: [
    'A locker moves through distinct, mutually exclusive phases (free, reserved, occupied, expired) with different valid actions in each. What pattern models that?',
    '"Pick the smallest locker the package fits in" is a rule you might want to change later. Should it be hard-coded inside the locker-assignment logic, or pulled out somewhere swappable?',
    'Model each locker\'s lifecycle with the State pattern, pull size-based allocation into its own swappable strategy, and verify a generated pickup code against the specific reservation before opening and freeing a locker.',
  ],
};
