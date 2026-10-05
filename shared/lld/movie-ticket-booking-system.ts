import { allNodesLabeled, edgeLabelMatches, hasDominantNode, hasRole, implementorCount, keywordAnywhere } from '../rubric/checks.ts';
import type { RubricSpec } from '../rubric/types.ts';
import type { DesignProblem } from '../types.ts';

/**
 * The class-level counterpart to this app's HLD "Ticket Booking System" —
 * same seat-locking correctness problem, but the interesting decisions here
 * are the object model and a Strategy seam for pricing, not infrastructure.
 */

const RELATIONSHIP_KEYWORDS = ['extends', 'implements', 'has-a', 'has a', 'uses', 'aggregates', 'composes'];

const MOVIE_BOOKING_RUBRIC: RubricSpec = {
  id: 'design-a-movie-ticket-booking-system',
  title: 'Design a Movie Ticket Booking System — rubric',
  checks: [
    {
      id: 'has-abstraction',
      label: 'An interface or abstract class is present (e.g. pricing or seat-locking)',
      max: 3,
      run: (g) =>
        hasRole(g, 'interface') || hasRole(g, 'abstractClass')
          ? { points: 3, verdict: 'pass', detail: 'An interface or abstract class is present.' }
          : { points: 0, verdict: 'fail', detail: 'Name at least one abstraction — e.g. a PricingStrategy interface (standard vs. dynamic/surge pricing).' },
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
          ? { points: 0, verdict: 'fail', detail: 'One class accounts for a disproportionate share of the relationships here — a Show class that also decides pricing and manages lock expiry itself is the shape this checks for.' }
          : { points: 3, verdict: 'pass', detail: 'Responsibilities look reasonably distributed across classes.' },
    },
    {
      id: 'enum-named',
      label: 'An enum models seat status',
      max: 2,
      run: (g) =>
        hasRole(g, 'enumType')
          ? { points: 2, verdict: 'pass', detail: 'An enum is named for seat status.' }
          : { points: 0, verdict: 'fail', detail: 'A seat\'s status (available, locked, booked) is a small fixed set — model it as an enum.' },
    },
    {
      id: 'typed-relationships',
      label: 'Relationships between classes are typed, not generic arrows',
      max: 2,
      run: (g) =>
        edgeLabelMatches(g, RELATIONSHIP_KEYWORDS)
          ? { points: 2, verdict: 'pass', detail: 'At least one relationship is explicitly typed.' }
          : { points: 0, verdict: 'fail', detail: 'Label at least one arrow with what kind of relationship it is (extends, implements, has-a, uses).' },
    },
    {
      id: 'seat-locking-named',
      label: 'An atomic seat-locking mechanism with an expiry is named',
      max: 3,
      run: (g) =>
        keywordAnywhere(g, ['seat lock', 'temporary hold', 'pessimistic lock', 'lock timeout', 'hold expiry'])
          ? { points: 3, verdict: 'pass', detail: 'A seat-locking mechanism is named.' }
          : {
              points: 0,
              verdict: 'fail',
              detail: 'Name how two users are prevented from locking the same seat at the same instant (an atomic AVAILABLE-to-LOCKED transition), and what expires an abandoned hold.',
            },
    },
    {
      id: 'pricing-strategy-named',
      label: 'A pricing concept is named',
      max: 2,
      run: (g) =>
        keywordAnywhere(g, ['pricing', 'dynamic pricing', 'seat category price'])
          ? { points: 2, verdict: 'pass', detail: 'A pricing concept is named.' }
          : { points: 0, verdict: 'fail', detail: 'Name how a seat\'s price is determined — this is a natural Strategy-pattern seam (standard vs. dynamic/surge pricing).' },
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

const STATEMENT = `Design the class structure for a movie ticket booking system (BookMyShow/Fandango-style): a user browses shows, picks seats, and books them — with no two users ever able to book the same seat for the same show.

Functional requirements:
- Browse shows for a movie at a theater, and view the seat map for a chosen show.
- Select one or more seats and place a temporary hold on them while completing payment.
- Confirm the booking once payment succeeds; release the hold automatically if payment doesn't complete in time.

Design expectations:
- Use an interface or abstract class somewhere a real interviewer would expect polymorphism (pricing, or the seat-locking mechanism).
- Name how two users are prevented from locking the same seat at the same instant.
- Draw this as a class diagram: classes, interfaces, and typed relationships.`;

const REFERENCE_APPROACH = `Model Movie, Theater, and Show (a specific screening: a movie, a theater/screen, a start time) as plain classes, with Show owning a map of Seat objects keyed by seat number, each carrying a SeatStatus enum (AVAILABLE/LOCKED/BOOKED). Selecting seats creates a SeatLock — a temporary hold with an expiry timestamp — rather than an immediate Booking; the actual concurrency-critical operation is transitioning a seat from AVAILABLE to LOCKED, which must be a single atomic/conditional operation (a compare-and-set on seat status, or a short-lived distributed lock) so two users selecting the same seat in the same instant can't both succeed. A background sweep (or a TTL-based expiry) releases locks that were never converted into a paid Booking, returning those seats to AVAILABLE. Pricing is a natural Strategy seam: a PricingStrategy interface with implementations like StandardPricing and DynamicPricing (surge pricing near sellout) computes a seat's price without Show or Booking needing to know which scheme is active. A Booking finalizes a set of previously-locked seats once payment succeeds, transitioning them to BOOKED. The god-class failure mode is a Show class that also decides pricing and manages lock expiry timers itself — those belong to PricingStrategy and a dedicated lock-expiry mechanism respectively.`;

export const MOVIE_TICKET_BOOKING_SYSTEM: DesignProblem = {
  slug: 'design-a-movie-ticket-booking-system',
  track: 'lld',
  title: 'Design a Movie Ticket Booking System',
  difficulty: 'Medium',
  statement: STATEMENT,
  rubric: MOVIE_BOOKING_RUBRIC,
  referenceApproach: REFERENCE_APPROACH,
  hints: [
    'Two users click the same seat within a few milliseconds of each other. What has to happen for exactly one of them to succeed?',
    'A user locks a seat and then abandons checkout without paying. What actually gets that seat back to available?',
    'Model seat locking as an atomic AVAILABLE-to-LOCKED transition with an explicit expiry, and give pricing its own Strategy interface (Standard/Dynamic) so surge pricing near sellout doesn\'t require touching Show or Booking.',
  ],
};
