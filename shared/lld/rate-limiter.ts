import { allNodesLabeled, edgeLabelMatches, hasDominantNode, hasRole, implementorCount, keywordAnywhere } from '../rubric/checks.ts';
import type { RubricSpec } from '../rubric/types.ts';
import type { DesignProblem } from '../types.ts';

/**
 * The second LLD problem: a pluggable-algorithm library rather than a domain
 * model — deliberately different flavor from the parking lot's entity modeling,
 * to exercise the same primitives against a different kind of class design.
 */

const RELATIONSHIP_KEYWORDS = ['extends', 'implements', 'has-a', 'has a', 'uses', 'aggregates', 'composes'];

const RATE_LIMITER_RUBRIC: RubricSpec = {
  id: 'design-a-rate-limiter',
  title: 'Design a Rate Limiter (class design) — rubric',
  checks: [
    {
      id: 'has-abstraction',
      label: 'A RateLimiter interface/abstraction is present',
      max: 3,
      run: (g) =>
        hasRole(g, 'interface') || hasRole(g, 'abstractClass')
          ? { points: 3, verdict: 'pass', detail: 'An interface or abstract class is present for the limiting algorithm.' }
          : { points: 0, verdict: 'fail', detail: 'Name a RateLimiter interface/abstraction so the algorithm is swappable, rather than hard-coding one approach.' },
    },
    {
      id: 'multiple-algorithms',
      label: 'At least two algorithms implement the abstraction (e.g. token bucket, sliding window)',
      max: 3,
      run: (g) => {
        const n = implementorCount(g, ['interface', 'abstractClass']);
        if (n >= 2) return { points: 3, verdict: 'pass', detail: `${n} concrete algorithms implement the abstraction.` };
        if (n === 1) return { points: 1, verdict: 'partial', detail: 'Only one algorithm implements the abstraction — with just one, the interface isn\'t buying you anything yet.' };
        return { points: 0, verdict: 'fail', detail: 'No concrete algorithm class is wired to (implements/extends) the RateLimiter abstraction.' };
      },
    },
    {
      id: 'no-god-class',
      label: 'No single class does everything',
      max: 3,
      run: (g) =>
        hasDominantNode(g)
          ? { points: 0, verdict: 'fail', detail: 'One class accounts for a disproportionate share of all the relationships here — delegate storage and construction to collaborators instead.' }
          : { points: 3, verdict: 'pass', detail: 'Responsibilities look reasonably distributed across classes.' },
    },
    {
      id: 'storage-abstracted',
      label: 'Counter/state storage is a separate abstraction from the algorithm',
      max: 2,
      run: (g) =>
        keywordAnywhere(g, ['store', 'counter', 'backend', 'persistence'])
          ? { points: 2, verdict: 'pass', detail: 'A separate storage/state abstraction is named.' }
          : {
              points: 0,
              verdict: 'fail',
              detail: 'Separate WHERE the count/tokens live (a Store abstraction, e.g. in-memory vs. Redis-backed) from the algorithm — this is what lets the same algorithm run in one process or across a distributed fleet.',
            },
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
      id: 'concurrency-named',
      label: 'Thread-safety / concurrency is called out',
      max: 3,
      run: (g) =>
        keywordAnywhere(g, ['thread-safe', 'thread safe', 'concurrent', 'lock', 'atomic', 'mutex', 'synchronized'])
          ? { points: 3, verdict: 'pass', detail: 'A concurrency-safety mechanism is named.' }
          : {
              points: 0,
              verdict: 'fail',
              detail: 'Name how the counter/token update stays correct under concurrent access (an atomic operation, a lock, or an atomic Redis script) — a naive check-then-act update racing under load is the single most common bug in a real rate limiter.',
            },
    },
    {
      id: 'factory-named',
      label: 'A factory/config entry point builds the right strategy',
      max: 2,
      run: (g) =>
        keywordAnywhere(g, ['factory', 'builder', 'config'])
          ? { points: 2, verdict: 'pass', detail: 'A construction entry point is named.' }
          : { points: 0, verdict: 'fail', detail: 'Name something that decides which algorithm + store to construct from configuration, so callers don\'t hard-code a concrete class.' },
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

const STATEMENT = `Design the class structure for an in-process rate-limiting library: given a key (e.g. a client ID or API key), decide whether to allow or reject the next call, using a pluggable algorithm.

Functional requirements:
- Support at least two limiting algorithms (e.g. token bucket, sliding window), swappable without changing calling code.
- The counter/token state must be swappable between in-memory (single process) and a shared backend (e.g. Redis, for a distributed fleet), without changing the algorithm classes.
- Must behave correctly when called concurrently from multiple threads (or, with a shared backend, multiple processes) for the same key.

Design expectations:
- Draw this as a class diagram: classes, interfaces, and typed relationships (implements / has-a / uses) — not an infrastructure diagram.`;

const REFERENCE_APPROACH = `Define a RateLimiter interface with a single method like allow(key): boolean. TokenBucketRateLimiter and SlidingWindowRateLimiter each implement it, so callers depend only on the interface. Both delegate their counter/token state to a separate Store interface — an abstraction over "where the count lives" — with an InMemoryStore and a RedisStore implementation; this is exactly what lets the same algorithm classes run unmodified whether the limiter is protecting one process or a fleet sharing state in Redis. A RateLimiterFactory (Factory pattern) builds the right RateLimiter + Store combination from configuration, so nothing else in the codebase constructs a concrete class directly. The detail that separates a working rate limiter from a broken one under load: the Store's increment/consume operation must be atomic — a synchronized block for InMemoryStore, or an atomic Lua script for RedisStore — because a naive read-then-write update racing across concurrent callers on the same key will let more requests through than the limit allows.`;

export const RATE_LIMITER: DesignProblem = {
  slug: 'design-a-rate-limiter',
  track: 'lld',
  title: 'Design a Rate Limiter',
  difficulty: 'Medium',
  statement: STATEMENT,
  rubric: RATE_LIMITER_RUBRIC,
  referenceApproach: REFERENCE_APPROACH,
  hints: [
    'The prompt wants at least two algorithms, swappable at runtime. What\'s the one interface they should all share?',
    'The counter state needs to work in a single process today, and across a fleet sharing Redis tomorrow — where should that decision live, separate from the algorithm?',
    'Define a RateLimiter interface (TokenBucket/SlidingWindow implementations) that delegates counter state to a separate Store abstraction (in-memory vs. Redis-backed), and make sure that Store\'s increment operation is atomic.',
  ],
};
