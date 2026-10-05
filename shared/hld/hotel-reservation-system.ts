import { allNodesLabeled, hasRole, keywordAnywhere, pathExists, redundancyEvidence } from '../rubric/checks.ts';
import type { RubricSpec } from '../rubric/types.ts';
import type { DesignProblem } from '../types.ts';

/**
 * An inventory-with-overbooking-protection problem: the crux is preventing
 * two guests from booking the last room for the same night (a concurrency
 * problem, not a search problem) — same family as Ticket Booking, but a
 * different domain (date-range inventory vs. single-event seat maps) with
 * its own wrinkle: overbooking is sometimes an intentional business choice.
 */

const LOCKING_KEYWORDS = ['pessimistic lock', 'optimistic lock', 'select for update', 'row lock'];
const IDEMPOTENCY_KEYWORDS = ['idempoten', 'idempotency key'];
const SEARCH_CACHE_KEYWORDS = ['search cache', 'availability cache', 'cached availability'];
const OVERBOOKING_KEYWORDS = ['overbook', 'over-book'];
const HOLD_KEYWORDS = ['hold', 'reservation hold', 'ttl on the hold', 'expire the hold'];
const PAYMENT_KEYWORDS = ['payment', 'confirm the booking'];

const HOTEL_RESERVATION_RUBRIC: RubricSpec = {
  id: 'design-a-hotel-reservation-system',
  title: 'Design a Hotel Reservation System — rubric',
  checks: [
    {
      id: 'concurrency-control',
      label: 'Booking the last room is protected by explicit concurrency control',
      max: 4,
      run: (g) =>
        keywordAnywhere(g, LOCKING_KEYWORDS)
          ? { points: 4, verdict: 'pass', detail: 'Explicit concurrency control is named.' }
          : {
              points: 0,
              verdict: 'fail',
              detail: 'Two guests booking the last room for the same night at the same instant is the core failure mode — name the actual mechanism preventing a double-booking (a row-level lock, or an optimistic check on a version column).',
            },
    },
    {
      id: 'hold-with-ttl',
      label: 'A room is held with a TTL during checkout, not booked immediately',
      max: 3,
      run: (g) =>
        keywordAnywhere(g, HOLD_KEYWORDS)
          ? { points: 3, verdict: 'pass', detail: 'A temporary hold with expiry is named.' }
          : {
              points: 0,
              verdict: 'fail',
              detail: 'A guest needs a few minutes to enter payment details — name a temporary hold on the room (with a TTL) so it isn\'t sold to someone else mid-checkout, but also isn\'t locked forever if they abandon the flow.',
            },
    },
    {
      id: 'idempotent-booking',
      label: 'The booking/payment request is idempotent',
      max: 3,
      run: (g) =>
        keywordAnywhere(g, IDEMPOTENCY_KEYWORDS)
          ? { points: 3, verdict: 'pass', detail: 'Idempotency is named.' }
          : { points: 0, verdict: 'fail', detail: 'A retried "confirm booking" click (a flaky network, a double-tap) must not create two reservations or charge twice — name an idempotency key on the request.' },
    },
    {
      id: 'search-cache',
      label: 'Availability search is served from a cache, separate from the booking write path',
      max: 2,
      run: (g) =>
        keywordAnywhere(g, SEARCH_CACHE_KEYWORDS) || hasRole(g, 'cache')
          ? { points: 2, verdict: 'pass', detail: 'A search-side cache is present.' }
          : { points: 0, verdict: 'fail', detail: 'Search traffic (browsing availability) vastly outnumbers actual bookings — serve search from a cache, and only hit the strongly-consistent booking path at the moment of commit.' },
    },
    {
      id: 'overbooking-policy',
      label: 'The overbooking policy is stated explicitly',
      max: 2,
      run: (g) =>
        keywordAnywhere(g, OVERBOOKING_KEYWORDS)
          ? { points: 2, verdict: 'pass', detail: 'An overbooking policy is stated.' }
          : {
              points: 0,
              verdict: 'fail',
              detail: 'Real hotel systems intentionally overbook by a small margin to offset no-shows — state whether this design allows a small, deliberate overbook buffer or strictly never oversells.',
            },
    },
    {
      id: 'payment-integration',
      label: 'Payment confirmation gates final booking commitment',
      max: 2,
      run: (g) =>
        keywordAnywhere(g, PAYMENT_KEYWORDS)
          ? { points: 2, verdict: 'pass', detail: 'Payment gating is named.' }
          : { points: 0, verdict: 'fail', detail: 'Say where payment fits — the booking is only finalized once payment succeeds; a failed charge releases the hold.' },
    },
    {
      id: 'lb-in-front',
      label: 'A load balancer sits in front of the app tier',
      max: 1,
      run: (g) => (pathExists(g, 'client', 'loadBalancer') ? { points: 1, verdict: 'pass', detail: 'A load balancer is present.' } : { points: 0, verdict: 'fail', detail: 'Route the client through a load balancer to the app tier.' }),
    },
    {
      id: 'app-tier-redundant',
      label: 'The app tier has more than one instance',
      max: 1,
      run: (g) =>
        redundancyEvidence(g, 'appServer')
          ? { points: 1, verdict: 'pass', detail: 'The app tier is shown as more than one instance.' }
          : { points: 0, verdict: 'fail', detail: 'Show the app tier as more than one instance.' },
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

const STATEMENT = `Design a hotel reservation system: guests search for available rooms by date range and location, and book one without the system ever double-booking the same room for overlapping dates.

Functional requirements:
- Search available rooms by city, date range, and guest count.
- Book a specific room for a date range; payment must succeed before the booking is final.
- Two guests attempting to book the same room for overlapping dates at the same time must not both succeed.

Non-functional requirements / scale:
- Searches vastly outnumber actual bookings (most browsing never converts).
- A guest needs a realistic window (minutes) to complete checkout without the room being sold out from under them.
- Some level of intentional overbooking (to offset no-shows) may be a business requirement, not a bug.`;

const REFERENCE_APPROACH = `Search (browse availability by city/date range) is the overwhelmingly dominant traffic pattern and doesn't need strong consistency at the instant of reading — it's served from a cache (or a read replica) of room availability, refreshed frequently but not necessarily perfectly real-time. The moment a guest selects a room to book, the flow switches to the strongly-consistent path: a short-lived hold is placed on that room for that date range (with a TTL of a few minutes) so it can't be sold to someone else mid-checkout, but automatically releases back to available inventory if the guest abandons the flow without completing payment. Placing that hold — and the final booking commit — is protected by explicit concurrency control at the datastore: a row-level lock (SELECT ... FOR UPDATE) on the room-date inventory row, or an optimistic check (a version column that must match, retried on conflict), so two guests racing for the last room on the same dates can't both succeed. The actual booking confirmation request carries an idempotency key, so a client retry (a flaky network, a double-tap on "confirm") doesn't create a duplicate reservation or double-charge the guest. The booking only becomes final once payment succeeds; a failed charge releases the hold back to inventory rather than leaving a phantom reservation. Whether the system allows a small, deliberate overbooking margin (common in real hotel systems, to offset a predictable no-show rate) or strictly guarantees zero oversell is a stated business decision, not an accident of the locking scheme — and it changes what "double-booking" even means for this specific design.`;

export const HOTEL_RESERVATION_SYSTEM: DesignProblem = {
  slug: 'design-a-hotel-reservation-system',
  track: 'hld',
  title: 'Design a Hotel Reservation System',
  difficulty: 'Medium',
  statement: STATEMENT,
  rubric: HOTEL_RESERVATION_RUBRIC,
  referenceApproach: REFERENCE_APPROACH,
  hints: [
    'Two guests click "book" on the last room for the same dates within milliseconds of each other. What actually stops both from succeeding?',
    'A guest takes three minutes to enter payment details. Should the room stay bookable by someone else during those three minutes?',
    'Serve search from a cache, place a short-lived, TTL\'d hold on a room during checkout, protect the actual booking commit with a row lock or optimistic version check, and make the confirmation request idempotent.',
  ],
};
