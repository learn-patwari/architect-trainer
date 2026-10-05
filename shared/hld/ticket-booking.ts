import { allNodesLabeled, hasRole, keywordAnywhere, redundancyEvidence } from '../rubric/checks.ts';
import type { RubricSpec } from '../rubric/types.ts';
import type { DesignProblem } from '../types.ts';

/**
 * The Ticketmaster-shaped problem: like the flash sale, correctness under
 * concurrency is the crux, but the mechanism is a time-bounded HOLD with
 * automatic expiry rather than a plain atomic decrement.
 */

const LOCKING_KEYWORDS = ['distributed lock', 'conditional update', 'select for update', 'optimistic lock', 'pessimistic lock'];
const EXPIRY_KEYWORDS = ['ttl', 'hold expiry', 'expire', 'redis expire', 'lease'];
const SHEDDING_KEYWORDS = ['rate limit', 'throttle', 'shed', 'waiting room', 'queue-it'];

const TICKET_BOOKING_RUBRIC: RubricSpec = {
  id: 'design-a-ticket-booking-system',
  title: 'Design a Ticket Booking System — rubric',
  checks: [
    {
      id: 'load-balancer',
      label: 'Load balancer in front of the app tier',
      max: 3,
      run: (g) =>
        hasRole(g, 'loadBalancer')
          ? { points: 3, verdict: 'pass', detail: 'A load balancer is present.' }
          : { points: 0, verdict: 'fail', detail: 'No load balancer drawn.' },
    },
    {
      id: 'app-tier',
      label: 'Application / API tier present',
      max: 2,
      run: (g) =>
        hasRole(g, 'appServer')
          ? { points: 2, verdict: 'pass', detail: 'An app/API tier is present.' }
          : { points: 0, verdict: 'fail', detail: 'No app/API server tier drawn.' },
    },
    {
      id: 'atomic-seat-lock',
      label: 'Placing a hold on a seat is named as one atomic/conditional operation',
      max: 3,
      run: (g) =>
        keywordAnywhere(g, LOCKING_KEYWORDS)
          ? { points: 3, verdict: 'pass', detail: 'An atomic seat-locking mechanism is named.' }
          : {
              points: 0,
              verdict: 'fail',
              detail: 'Name the exact atomic mechanism (a conditional UPDATE, a distributed lock, SELECT FOR UPDATE) — reading "is this seat free?" and then writing "hold it" as two separate steps lets two users both grab the same seat.',
            },
    },
    {
      id: 'hold-expiry',
      label: 'An automatic hold-expiry mechanism is named',
      max: 3,
      run: (g) =>
        keywordAnywhere(g, EXPIRY_KEYWORDS)
          ? { points: 3, verdict: 'pass', detail: 'A hold-expiry mechanism is named.' }
          : { points: 0, verdict: 'fail', detail: 'Say what automatically releases a seat when a user holds it but never pays (a TTL, a lease, a background expiry job) — "the hold times out" alone doesn\'t say how.' },
    },
    {
      id: 'traffic-shedding',
      label: 'The initial rush of concurrent requests is shed or queued',
      max: 2,
      run: (g) =>
        keywordAnywhere(g, SHEDDING_KEYWORDS) || hasRole(g, 'queue')
          ? { points: 2, verdict: 'pass', detail: 'Traffic shedding or a queue absorbs the initial spike.' }
          : { points: 0, verdict: 'fail', detail: 'A hugely popular on-sale event causes a traffic spike at t=0 — name how it\'s absorbed (rate limiting, a waiting room, a queue) rather than every request reaching the seat-locking path at once.' },
    },
    {
      id: 'datastore-present',
      label: 'A datastore for seats and bookings is present',
      max: 2,
      run: (g) =>
        hasRole(g, 'datastore')
          ? { points: 2, verdict: 'pass', detail: 'A datastore is present.' }
          : { points: 0, verdict: 'fail', detail: 'No datastore drawn.' },
    },
    {
      id: 'no-spof',
      label: 'No single point of failure across load balancer / app tier / datastore',
      max: 3,
      run: (g) => {
        const tiers = ['loadBalancer', 'appServer', 'datastore'] as const;
        const shown = tiers.filter((r) => redundancyEvidence(g, r));
        const missing = tiers.filter((r) => !shown.includes(r));
        const verdict = missing.length === 0 ? 'pass' : shown.length === 0 ? 'fail' : 'partial';
        const detail = missing.length === 0 ? 'Every tier shows redundancy evidence.' : `No redundancy shown for: ${missing.join(', ')}.`;
        return { points: shown.length, verdict, detail };
      },
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

const STATEMENT = `Design a ticket-booking system for an event with a fixed number of seats. Multiple users may try to book the same seat at the same instant, and a seat can only ever be sold once.

Functional requirements:
- Browse the seat map for an event.
- Place a temporary hold on a seat while completing payment (e.g. 10 minutes).
- Confirm the booking once payment succeeds; if the hold expires unpaid, the seat becomes available again automatically.

Non-functional requirements / scale:
- A popular event's on-sale moment causes a massive concurrent spike.
- A seat must never be double-booked, under any level of concurrency.`;

const REFERENCE_APPROACH = `Clients reach the app tier through a load balancer; the initial on-sale rush is shed via rate limiting or a queue/waiting room so the seat-locking path itself isn't hit by every request at once. Placing a hold on a seat is a single atomic, conditional operation — a conditional UPDATE (\`UPDATE seats SET status='held' WHERE seat_id=? AND status='available'\`) or a distributed lock — so two concurrent hold attempts on the same seat can't both succeed; whichever loses the race gets told the seat is taken immediately. Every hold carries an explicit expiry: a TTL on a Redis key mirroring the hold, or a lease with a background job sweeping expired holds back to \`available\` — without this, an abandoned checkout would permanently lock a seat. Seats and confirmed bookings persist in a durable datastore. Redundancy across the load balancer, app tier, and datastore. The two things interviewers listen for: (1) the hold being genuinely atomic (the same lesson as a flash sale's inventory decrement, applied to a hold instead), and (2) an explicit, automatic expiry mechanism rather than "it just times out."`;

export const TICKET_BOOKING: DesignProblem = {
  slug: 'design-a-ticket-booking-system',
  track: 'hld',
  title: 'Design a Ticket Booking System',
  difficulty: 'Hard',
  statement: STATEMENT,
  rubric: TICKET_BOOKING_RUBRIC,
  referenceApproach: REFERENCE_APPROACH,
  hints: [
    'This has the same race condition as a flash sale — what\'s the seat-booking equivalent of "check stock, then decrement"?',
    'A user holds a seat for ten minutes, then closes the tab without paying. What actually gets that seat back into the available pool?',
    'Place holds with one atomic conditional operation (a conditional UPDATE or a distributed lock), and give every hold an explicit TTL/expiry mechanism — not just "it times out."',
  ],
};
