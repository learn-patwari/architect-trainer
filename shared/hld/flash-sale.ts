import { allNodesLabeled, hasRole, keywordAnywhere, pathExists, redundancyEvidence } from '../rubric/checks.ts';
import type { RubricSpec } from '../rubric/types.ts';
import type { DesignProblem } from '../types.ts';

/**
 * A massive-spike, correctness-under-concurrency problem: the crux isn't
 * throughput, it's that "check remaining stock, then decrement" must be one
 * atomic operation or the system oversells. Reuses every existing primitive.
 */

const ATOMIC_KEYWORDS = ['atomic decrement', 'redis decr', 'conditional update', 'optimistic lock', 'compare-and-swap', 'cas', 'lua script'];
const SHEDDING_KEYWORDS = ['rate limit', 'throttle', 'shed', 'waiting room', 'queue-it'];
const ISOLATION_KEYWORDS = ['isolate', 'dedicated', 'separate service', 'bulkhead'];

const FLASH_SALE_RUBRIC: RubricSpec = {
  id: 'design-a-flash-sale',
  title: 'Design a Flash Sale System — rubric',
  checks: [
    {
      id: 'load-balancer',
      label: 'Load balancer in front of the app tier',
      max: 3,
      run: (g) =>
        pathExists(g, 'loadBalancer', 'appServer')
          ? { points: 3, verdict: 'pass', detail: 'A load balancer sits in front of the app tier.' }
          : hasRole(g, 'loadBalancer')
            ? { points: 1, verdict: 'partial', detail: 'A load balancer is drawn but has no path into the app tier.' }
            : { points: 0, verdict: 'fail', detail: 'No load balancer in front of the app tier.' },
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
      id: 'queue-absorbs-spike',
      label: 'A queue absorbs the traffic spike rather than hitting inventory directly',
      max: 3,
      run: (g) => {
        const wired = pathExists(g, 'appServer', 'queue');
        if (wired) return { points: 3, verdict: 'pass', detail: 'Purchase attempts are decoupled from processing via a queue.' };
        if (hasRole(g, 'queue')) return { points: 1, verdict: 'partial', detail: 'A queue is drawn but not wired to the app tier.' };
        return { points: 0, verdict: 'fail', detail: 'No queue — 10M simultaneous purchase attempts hitting the inventory store directly will fall over.' };
      },
    },
    {
      id: 'atomic-inventory',
      label: 'Inventory check-and-decrement is named as one atomic operation',
      max: 3,
      run: (g) =>
        keywordAnywhere(g, ATOMIC_KEYWORDS)
          ? { points: 3, verdict: 'pass', detail: 'An atomic inventory decrement mechanism is named.' }
          : {
              points: 0,
              verdict: 'fail',
              detail: 'Name the exact atomic mechanism (e.g. Redis DECR, a conditional/optimistic update, a Lua script) — a separate read-then-write "check stock, then decrement" is the classic overselling bug this problem exists to catch.',
            },
    },
    {
      id: 'traffic-shedding',
      label: 'Rate limiting or a waiting room protects the rest of the site',
      max: 2,
      run: (g) =>
        keywordAnywhere(g, SHEDDING_KEYWORDS)
          ? { points: 2, verdict: 'pass', detail: 'Traffic shedding/rate limiting is named.' }
          : { points: 0, verdict: 'fail', detail: 'Name how excess load is shed (rate limiting, a virtual waiting room) rather than every request reaching the backend.' },
    },
    {
      id: 'isolated-from-main-site',
      label: 'The flash-sale path is isolated from the rest of the site',
      max: 2,
      run: (g) =>
        keywordAnywhere(g, ISOLATION_KEYWORDS)
          ? { points: 2, verdict: 'pass', detail: 'Isolation from the main site is named.' }
          : {
              points: 0,
              verdict: 'fail',
              detail: 'Say how this hot path is isolated (a dedicated service/cluster, a bulkhead) so a flash-sale meltdown doesn\'t take down normal browsing and checkout for everyone else.',
            },
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

const STATEMENT = `Design a flash-sale system: a limited quantity of a highly-desired item goes on sale at a specific instant, and demand is expected to vastly exceed supply in the first few seconds.

Functional requirements:
- At T=0, the item becomes purchasable; the quantity is fixed (e.g. 1,000 units).
- A purchase attempt must never oversell — the system can never sell more units than exist.
- A successful purchase gets a confirmation; an unsuccessful one gets a clear "sold out" response, fast.

Non-functional requirements / scale:
- Up to 10M concurrent users attempt to buy within the first 10 seconds.
- The inventory check-and-decrement must be correct under massive concurrency — no overselling, ever.
- The rest of the site (browsing, other checkouts) must stay up even if the flash-sale endpoint is hammered.`;

const REFERENCE_APPROACH = `Clients hit a load balancer into a dedicated, isolated flash-sale service — deliberately bulkheaded away from the rest of the site, so a meltdown here doesn't take down normal browsing or checkout. Because 10M people can hit "buy" in the same second, incoming attempts are shed at the edge: a rate limiter or a virtual waiting room admits requests at a rate the backend can actually handle, rather than letting all 10M reach the app tier. Inventory count lives in a fast, atomic store (Redis, using DECR or a small Lua script that checks-and-decrements in one round trip) — this is the crux of the problem: a naive "read remaining stock, then decrement" as two separate operations races under concurrency and oversells, no matter how fast each operation is. A decrement that would go negative is rejected immediately as sold out; a successful decrement enqueues an order-creation event, processed asynchronously and persisted to a durable datastore, so the fast atomic path doesn't have to also do the slower work of writing a full order record. Redundancy: multiple load balancer and app-tier instances; the atomic counter itself is single-keyed by design but the store holding it should still be replicated for durability. The two things interviewers listen for: (1) the check-and-decrement being genuinely atomic, not a race dressed up as one, and (2) isolating this hot path from the rest of the system.`;

export const FLASH_SALE: DesignProblem = {
  slug: 'design-a-flash-sale',
  track: 'hld',
  title: 'Design a Flash Sale System',
  difficulty: 'Hard',
  statement: STATEMENT,
  rubric: FLASH_SALE_RUBRIC,
  referenceApproach: REFERENCE_APPROACH,
  hints: [
    '"Check remaining stock, then decrement it" — what happens if a thousand requests do exactly that at the exact same instant?',
    'Should all 10 million requests even be allowed to reach your inventory logic at once?',
    'Make the check-and-decrement one atomic operation (Redis DECR or a Lua script that can\'t go negative), and shed the initial spike with a rate limiter or waiting room before it ever reaches that hot path.',
  ],
};
