import { allNodesLabeled, hasRole, keywordAnywhere, pathExists, redundancyEvidence } from '../rubric/checks.ts';
import type { RubricSpec } from '../rubric/types.ts';
import type { DesignProblem } from '../types.ts';

/**
 * The infra-shaped rate limiter (ByteByteGo's HLD chapter): a shared limiter
 * service/library that many app servers consult, backed by a shared store —
 * distinct from the LLD rate limiter, which designs the algorithm's class
 * structure inside one process rather than the cross-fleet infra around it.
 */

const ALGORITHM_KEYWORDS = ['token bucket', 'leaky bucket', 'sliding window', 'fixed window'];
const SHARED_STORE_KEYWORDS = ['redis', 'shared store', 'shared state', 'centralized counter'];
const ATOMIC_KEYWORDS = ['lua script', 'atomic', 'incr', 'compare-and-swap', 'cas'];
const RULE_CONFIG_KEYWORDS = ['rule', 'config', 'per-user', 'per-ip', 'per-api-key', 'tier'];
const FAIL_MODE_KEYWORDS = ['fail open', 'fail closed', 'fail-open', 'fail-closed'];
const HEADER_KEYWORDS = ['429', 'retry-after', 'rate limit header', 'x-ratelimit'];

const DISTRIBUTED_RATE_LIMITER_RUBRIC: RubricSpec = {
  id: 'design-a-distributed-rate-limiter',
  title: 'Design a Distributed Rate Limiter — rubric',
  checks: [
    {
      id: 'lb-in-front',
      label: 'A load balancer sits in front of the app tier',
      max: 2,
      run: (g) =>
        pathExists(g, 'client', 'loadBalancer') && pathExists(g, 'loadBalancer', 'appServer')
          ? { points: 2, verdict: 'pass', detail: 'Client -> load balancer -> app tier.' }
          : { points: 0, verdict: 'fail', detail: 'Route the client through a load balancer to the app/limiter tier.' },
    },
    {
      id: 'shared-store',
      label: 'A shared store backs the counters across app servers',
      max: 3,
      run: (g) =>
        hasRole(g, 'cache') && keywordAnywhere(g, SHARED_STORE_KEYWORDS)
          ? { points: 3, verdict: 'pass', detail: 'A shared store (e.g. Redis) is drawn and named.' }
          : {
              points: 0,
              verdict: 'fail',
              detail: 'A limiter with per-app-server in-memory counters lets each instance allow its own share of the limit — name a shared, fast store (Redis) every instance checks against.',
            },
    },
    {
      id: 'algorithm-named',
      label: 'A specific limiting algorithm is named',
      max: 3,
      run: (g) =>
        keywordAnywhere(g, ALGORITHM_KEYWORDS)
          ? { points: 3, verdict: 'pass', detail: 'A specific algorithm is named.' }
          : { points: 0, verdict: 'fail', detail: 'Name the actual algorithm (token bucket, sliding window, etc.) — "rate limiting" alone doesn\'t say how the decision is made.' },
    },
    {
      id: 'atomicity-named',
      label: 'The shared counter update is atomic',
      max: 3,
      run: (g) =>
        keywordAnywhere(g, ATOMIC_KEYWORDS)
          ? { points: 3, verdict: 'pass', detail: 'An atomic update mechanism is named.' }
          : {
              points: 0,
              verdict: 'fail',
              detail: 'Say how the check-and-increment against the shared store stays atomic under concurrent requests (an atomic Redis INCR, or a Lua script) — a naive read-then-write races and over-admits.',
            },
    },
    {
      id: 'rule-scope-named',
      label: 'Rate-limit scope/config is named (per-user, per-IP, per-API-key, or tiered)',
      max: 2,
      run: (g) =>
        keywordAnywhere(g, RULE_CONFIG_KEYWORDS)
          ? { points: 2, verdict: 'pass', detail: 'A rate-limit scope/rule is named.' }
          : { points: 0, verdict: 'fail', detail: 'Say what the limit actually keys on (per-user, per-IP, per-API-key) — a single global limit is rarely the real requirement.' },
    },
    {
      id: 'fail-mode-named',
      label: 'Behavior when the shared store is unavailable is named',
      max: 2,
      run: (g) =>
        keywordAnywhere(g, FAIL_MODE_KEYWORDS)
          ? { points: 2, verdict: 'pass', detail: 'A fail-open/fail-closed decision is named.' }
          : {
              points: 0,
              verdict: 'fail',
              detail: 'Say what happens to traffic when the shared store itself is unreachable — fail open (let requests through, protecting availability) or fail closed (reject everything, protecting the backend) is a real, stated trade-off.',
            },
    },
    {
      id: 'client-signal',
      label: 'The client-facing signal for a throttled request is named',
      max: 2,
      run: (g) =>
        keywordAnywhere(g, HEADER_KEYWORDS)
          ? { points: 2, verdict: 'pass', detail: 'A concrete client-facing signal is named.' }
          : { points: 0, verdict: 'fail', detail: 'Say what a throttled client actually sees (HTTP 429, a Retry-After header) — a silently dropped request is a worse API than an explicit one.' },
    },
    {
      id: 'limiter-tier-redundant',
      label: 'The app/limiter tier has more than one instance',
      max: 1,
      run: (g) =>
        redundancyEvidence(g, 'appServer')
          ? { points: 1, verdict: 'pass', detail: 'The limiter/app tier is shown as more than one instance.' }
          : { points: 0, verdict: 'fail', detail: 'Show the limiter/app tier as more than one instance — a single instance is a SPOF regardless of what it enforces.' },
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

const STATEMENT = `Design a rate limiter that protects a set of backend services from being overwhelmed by too many requests from a single client (by user ID, IP, or API key), shared consistently across a fleet of app servers.

Functional requirements:
- Given a client identifier, allow or reject each request against a configured limit (e.g. 100 requests/minute).
- The limit must be enforced consistently across many app server instances, not per-instance.
- A rejected client gets a clear signal (not a silent drop or an ambiguous error).

Non-functional requirements / scale:
- Adds minimal latency to every request that passes through it (it sits on the hot path).
- Must not become a single point of failure for the traffic it's meant to protect.`;

const REFERENCE_APPROACH = `The limiter is usually a shared library or sidecar called from every app server, not a separate hop of its own, so it doesn't add a second network round trip to every request. Because it runs inside many app-server instances, counters must live in a shared, fast store (Redis) rather than per-instance memory — otherwise each instance independently allows its own share of the limit, silently multiplying the effective ceiling by the fleet size. The algorithm itself is typically a token bucket (tolerates bursts, smooth average) or a sliding-window counter (exact, a bit more bookkeeping); either way the check-and-increment against Redis must be atomic — a single Lua script (or Redis's own INCR + EXPIRE) rather than a separate GET then SET, which would race under concurrent requests for the same key. The rule itself is scoped explicitly (per-user, per-IP, or per-API-key, often with different limits per pricing tier) rather than one global number. A throttled request returns HTTP 429 with a Retry-After header, not a silent drop, so the client can back off correctly. Finally, the design states what happens when Redis itself is unreachable: fail-open (let requests through, protecting availability at the cost of the limit) or fail-closed (reject everything, protecting the backend at the cost of availability) — an explicit trade-off, not an accident of whatever the code happens to do on an exception.`;

export const DISTRIBUTED_RATE_LIMITER: DesignProblem = {
  slug: 'design-a-distributed-rate-limiter',
  track: 'hld',
  title: 'Design a Distributed Rate Limiter',
  difficulty: 'Medium',
  statement: STATEMENT,
  rubric: DISTRIBUTED_RATE_LIMITER_RUBRIC,
  referenceApproach: REFERENCE_APPROACH,
  hints: [
    'If every app server keeps its own counter in memory, what happens to the real, effective limit as you add more app servers?',
    'Two concurrent requests for the same client both read the counter, both see room, both increment. What has to be true about that read-then-write for the limit to actually hold?',
    'Back the counters with a shared store (Redis) that every app server checks, using an atomic increment (a Lua script), and state explicitly what happens to traffic if that shared store itself goes down.',
  ],
};
