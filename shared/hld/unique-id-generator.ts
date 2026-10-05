import { allNodesLabeled, hasRole, keywordAnywhere, pathExists, redundancyEvidence } from '../rubric/checks.ts';
import type { RubricSpec } from '../rubric/types.ts';
import type { DesignProblem } from '../types.ts';

/**
 * An Easy-tier HLD problem with almost no moving parts (one stateless service, no
 * datastore of its own) — which is exactly why it's a good first problem: the whole
 * exercise is one focused idea (generate unique IDs without a central bottleneck)
 * instead of juggling many tiers at once.
 */

const DECENTRALIZED_STRATEGY_KEYWORDS = ['snowflake', 'worker id', 'machine id', 'node id', 'distributed counter'];
const CLOCK_KEYWORDS = ['clock skew', 'clock drift', 'ntp', 'monotonic clock', 'system clock'];
const SORTABLE_KEYWORDS = ['roughly sortable', 'time-ordered', 'time ordered', 'monotonically increasing', 'sortable id', 'k-sortable'];
const BIT_LAYOUT_KEYWORDS = ['41 bit', '42 bit', 'epoch', 'bit layout', '64-bit', '64 bit'];

const UNIQUE_ID_GENERATOR_RUBRIC: RubricSpec = {
  id: 'design-a-unique-id-generator',
  title: 'Design a Unique ID Generator — rubric',
  checks: [
    {
      id: 'app-tier',
      label: 'An ID-generation service tier is present',
      max: 2,
      run: (g) => (hasRole(g, 'appServer') ? { points: 2, verdict: 'pass', detail: 'An ID-generation service is present.' } : { points: 0, verdict: 'fail', detail: 'Draw the ID-generation service itself as an app/service tier.' }),
    },
    {
      id: 'load-balancer',
      label: 'Load balancer in front of the ID-generation tier',
      max: 2,
      run: (g) => {
        if (pathExists(g, 'loadBalancer', 'appServer')) return { points: 2, verdict: 'pass', detail: 'A load balancer sits in front of the service tier.' };
        if (hasRole(g, 'loadBalancer')) return { points: 1, verdict: 'partial', detail: 'A load balancer is drawn but has no path into the service tier — connect it.' };
        return { points: 0, verdict: 'fail', detail: 'No load balancer in front of the ID-generation tier.' };
      },
    },
    {
      id: 'decentralized-strategy',
      label: 'A decentralized generation strategy is named (no single counter to bottleneck on)',
      max: 3,
      run: (g) =>
        keywordAnywhere(g, DECENTRALIZED_STRATEGY_KEYWORDS)
          ? { points: 3, verdict: 'pass', detail: 'A decentralized ID-generation strategy is named.' }
          : {
              points: 0,
              verdict: 'fail',
              detail: 'A single shared auto-increment counter is exactly the central bottleneck this problem exists to avoid — name a decentralized scheme (e.g. Snowflake: timestamp + machine/worker ID + a per-machine sequence).',
            },
    },
    {
      id: 'no-spof',
      label: 'The ID-generation tier itself has no single point of failure',
      max: 3,
      run: (g) =>
        redundancyEvidence(g, 'appServer')
          ? { points: 3, verdict: 'pass', detail: 'Multiple ID-generation nodes are shown.' }
          : { points: 0, verdict: 'fail', detail: 'A single ID-generation instance is a single point of failure — show more than one, each assigned a distinct worker/machine ID.' },
    },
    {
      id: 'clock-handling',
      label: 'Clock skew / clock drift across machines is addressed',
      max: 2,
      run: (g) =>
        keywordAnywhere(g, CLOCK_KEYWORDS)
          ? { points: 2, verdict: 'pass', detail: 'Clock handling across machines is addressed.' }
          : { points: 0, verdict: 'fail', detail: "If the strategy embeds a timestamp, say what happens when a machine's clock moves backward (e.g. NTP, or refusing to generate IDs until the clock catches up)." },
    },
    {
      id: 'sortable-ids',
      label: 'IDs are roughly time-sortable',
      max: 2,
      run: (g) =>
        keywordAnywhere(g, SORTABLE_KEYWORDS)
          ? { points: 2, verdict: 'pass', detail: 'IDs are noted as roughly time-sortable.' }
          : { points: 0, verdict: 'fail', detail: 'A useful property of a timestamp-prefixed ID scheme is that IDs sort roughly by creation time — name it, since it matters for anything indexing or paginating by ID.' },
    },
    {
      id: 'bit-layout',
      label: 'A concrete bit layout / epoch is named',
      max: 2,
      run: (g) =>
        keywordAnywhere(g, BIT_LAYOUT_KEYWORDS)
          ? { points: 2, verdict: 'pass', detail: 'A concrete bit layout is named.' }
          : { points: 0, verdict: 'fail', detail: 'Get concrete about the ID shape — e.g. a 64-bit ID split into a 41-bit timestamp (since a custom epoch), a machine-ID field, and a per-ms sequence.' },
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

const STATEMENT = `Design a service that generates globally unique IDs for use as primary keys across many other services (the way Twitter's Snowflake or Instagram's ID scheme do).

Functional requirements:
- Generate a unique ID on request, with no coordination required between callers.
- IDs should be roughly sortable by creation time.
- The service must keep working if any single node fails.

Non-functional requirements / scale:
- 100K+ IDs per second across the fleet, from many machines.
- Low latency — this call sits on the hot path of whatever is creating the record.
- No two machines may ever produce the same ID, even under clock drift.`;

const REFERENCE_APPROACH = `The naive answer — a single database's AUTO_INCREMENT column — is exactly the central bottleneck and single point of failure this problem is testing whether you'll reach for. Instead, run many stateless ID-generation nodes, each assigned a distinct machine/worker ID (via config, or claimed from a coordination service like ZooKeeper at startup). Each node produces a 64-bit ID as: 1 unused sign bit, a ~41-bit millisecond timestamp measured from a custom epoch (not Unix epoch, to leave more room before the field overflows), a ~10-bit machine ID, and a ~12-bit per-millisecond sequence number that increments if more than one ID is requested within the same millisecond. Because the timestamp is the high-order bits, IDs from any single node are naturally increasing, and IDs across nodes are roughly time-ordered even though not perfectly monotonic globally. The clock-drift edge case is the thing worth naming out loud: if a node's clock moves backward (NTP adjustment), it must detect that and either wait until its clock catches back up or refuse to generate IDs briefly — silently reusing a timestamp risks a collision. No datastore is needed for the generator itself; it's a pure, horizontally-scalable stateless computation, which is what makes this a genuinely easy service to run at scale once the ID shape and clock handling are right.`;

export const UNIQUE_ID_GENERATOR: DesignProblem = {
  slug: 'design-a-unique-id-generator',
  track: 'hld',
  title: 'Design a Unique ID Generator',
  difficulty: 'Easy',
  statement: STATEMENT,
  rubric: UNIQUE_ID_GENERATOR_RUBRIC,
  referenceApproach: REFERENCE_APPROACH,
  hints: [
    'A single shared auto-increment counter is the obvious first idea — and exactly the central bottleneck this problem wants you to avoid.',
    'What if each generating node had its own identity, and combined it with the current time?',
    'Use a Snowflake-style ID: a timestamp, a per-machine worker ID, and a per-millisecond sequence packed into one 64-bit number, so no node ever needs to coordinate with another to produce a unique ID.',
  ],
};
