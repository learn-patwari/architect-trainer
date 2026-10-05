import { allNodesLabeled, edgeLabelMatches, hasDominantNode, hasRole, implementorCount, keywordAnywhere } from '../rubric/checks.ts';
import type { RubricSpec } from '../rubric/types.ts';
import type { DesignProblem } from '../types.ts';

/**
 * The first LLD problem: class-level design instead of infrastructure. Reuses the
 * exact same Canvas/timer/scoring/AI-review pipeline as HLD — only the scene's
 * role vocabulary (interface/abstractClass/enumType) and these checks differ.
 */

const RELATIONSHIP_KEYWORDS = ['extends', 'implements', 'has-a', 'has a', 'uses', 'aggregates', 'composes'];

const PARKING_LOT_RUBRIC: RubricSpec = {
  id: 'design-a-parking-lot',
  title: 'Design a Parking Lot — rubric',
  checks: [
    {
      id: 'has-abstraction',
      label: 'An interface or abstract class is present',
      max: 3,
      run: (g) =>
        hasRole(g, 'interface') || hasRole(g, 'abstractClass')
          ? { points: 3, verdict: 'pass', detail: 'An interface or abstract class is present.' }
          : { points: 0, verdict: 'fail', detail: 'Program to an interface, not an implementation: name at least one abstraction (e.g. a Vehicle or PricingStrategy interface).' },
    },
    {
      id: 'polymorphism-used',
      label: 'At least two concrete classes implement/extend an abstraction',
      max: 3,
      run: (g) => {
        const n = implementorCount(g, ['interface', 'abstractClass']);
        if (n >= 2) return { points: 3, verdict: 'pass', detail: `${n} concrete classes implement or extend an abstraction.` };
        if (n === 1) return { points: 1, verdict: 'partial', detail: 'Only one class implements the abstraction — polymorphism needs at least a second to be worth having.' };
        return { points: 0, verdict: 'fail', detail: 'No concrete class is wired to (implements/extends) an interface or abstract class.' };
      },
    },
    {
      id: 'no-god-class',
      label: 'No single class does everything (a "god class")',
      max: 3,
      run: (g) =>
        hasDominantNode(g)
          ? { points: 0, verdict: 'fail', detail: 'One class accounts for a disproportionate share of all the relationships in this diagram — a sign it\'s doing too much; delegate to collaborators.' }
          : { points: 3, verdict: 'pass', detail: 'Responsibilities look reasonably distributed across classes.' },
    },
    {
      id: 'enum-named',
      label: 'An enum is used for a fixed set of variants (e.g. spot or vehicle type)',
      max: 2,
      run: (g) =>
        hasRole(g, 'enumType')
          ? { points: 2, verdict: 'pass', detail: 'An enum is named for a fixed set of variants.' }
          : { points: 0, verdict: 'fail', detail: 'Spot types and vehicle types are a fixed, known set — model that as an enum rather than free-text or scattered booleans.' },
    },
    {
      id: 'typed-relationships',
      label: 'Relationships between classes are typed, not generic arrows',
      max: 2,
      run: (g) =>
        edgeLabelMatches(g, RELATIONSHIP_KEYWORDS)
          ? { points: 2, verdict: 'pass', detail: 'At least one relationship is explicitly typed.' }
          : { points: 0, verdict: 'fail', detail: 'Label at least one arrow with what kind of relationship it is (extends, implements, has-a, uses) — an unlabeled arrow doesn\'t say whether it\'s inheritance or composition.' },
    },
    {
      id: 'pricing-named',
      label: 'A fee/pricing calculation concept is named',
      max: 2,
      run: (g) =>
        keywordAnywhere(g, ['fee', 'pricing', 'rate', 'cost calculation'])
          ? { points: 2, verdict: 'pass', detail: 'A fee/pricing concept is named.' }
          : { points: 0, verdict: 'fail', detail: 'Name how the parking fee is calculated on exit — this is usually where a Strategy pattern (swappable pricing rules) belongs.' },
    },
    {
      id: 'orchestrator-present',
      label: 'A top-level ParkingLot/Garage class coordinates the rest',
      max: 2,
      run: (g) =>
        keywordAnywhere(g, ['parkinglot', 'parking lot', 'garage'])
          ? { points: 2, verdict: 'pass', detail: 'A top-level coordinating class is present.' }
          : { points: 0, verdict: 'fail', detail: "Model the parking lot itself as a class that owns levels/spots and exposes park()/leave() — without it, spots and vehicles have no home." },
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

const STATEMENT = `Design the class structure for a parking lot system with multiple levels and multiple spot types (compact, large, handicap, motorcycle). Vehicles of different types park in compatible spots, and a fee is computed when the vehicle leaves.

Functional requirements:
- Park a vehicle in a compatible, available spot.
- Handle a vehicle leaving: free the spot and compute the fee.
- Support multiple levels, each with multiple spots of different types.
- Support at least two pricing schemes (e.g. flat rate vs. hourly).

Design expectations:
- Use an interface or abstract class somewhere a real interviewer would expect polymorphism (vehicle types, spot types, or pricing).
- Name the classes and the relationships between them (extends / implements / has-a / uses) — draw it as a class diagram, not an infrastructure diagram.`;

const REFERENCE_APPROACH = `Model an abstract Vehicle (or a Vehicle interface) with concrete subclasses Car, Motorcycle, and Truck, each declaring which spot size(s) it fits. Model spots similarly: either a ParkingSpot abstraction with concrete subclasses per type, or a single ParkingSpot class holding a SpotType enum — either is defensible, but the set of spot types should be an enum either way, since it's a small, fixed, known set. A ParkingLot class owns a collection of Level objects, each owning a collection of ParkingSpot objects, and exposes park(vehicle) and leave(ticket). Parking issues a Ticket recording entry time and assigned spot. On leave(), a PricingStrategy interface (Strategy pattern) — with HourlyPricing and FlatRatePricing implementations — computes the fee from the ticket's duration and vehicle/spot type, so adding a new pricing scheme later doesn't touch ParkingLot itself. The key thing to avoid is a single ParkingLot class that also decides pricing, tracks every vehicle by hand, and formats receipts — that's the god-class shape this rubric checks for; each of those belongs to its own collaborator instead.`;

export const PARKING_LOT: DesignProblem = {
  slug: 'design-a-parking-lot',
  track: 'lld',
  title: 'Design a Parking Lot',
  difficulty: 'Medium',
  statement: STATEMENT,
  rubric: PARKING_LOT_RUBRIC,
  referenceApproach: REFERENCE_APPROACH,
  hints: [
    'The prompt asks for at least two pricing schemes. What pattern lets you add a third later without touching ParkingLot itself?',
    'Spot types and vehicle types are each a small, fixed set — what should model that, instead of a string or a handful of booleans?',
    'Use a PricingStrategy interface (Strategy pattern) with HourlyPricing/FlatRatePricing implementations, an enum for spot/vehicle type, and a top-level ParkingLot class that owns levels and spots without computing prices itself.',
  ],
};
