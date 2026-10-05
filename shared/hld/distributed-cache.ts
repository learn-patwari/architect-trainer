import { allNodesLabeled, keywordAnywhere, redundancyEvidence } from '../rubric/checks.ts';
import type { RubricSpec } from '../rubric/types.ts';
import type { DesignProblem } from '../types.ts';

/**
 * A problem about the cache infrastructure itself (building something Redis
 * Cluster-shaped), not the usual "add a cache in front of a datastore" — the
 * crux is key placement (consistent hashing) and hot-key mitigation.
 */

const CONSISTENT_HASHING_KEYWORDS = ['consistent hashing', 'hash ring'];
const EVICTION_KEYWORDS = ['lru', 'lfu', 'ttl', 'eviction'];
const REPLICATION_KEYWORDS = ['replica', 'replication'];
const CLIENT_ROUTING_KEYWORDS = ['client-side hashing', 'proxy', 'coordinator', 'gossip', 'cluster map'];
const HOT_KEY_KEYWORDS = ['hot key', 'hotspot', 'request coalescing'];
const INVALIDATION_KEYWORDS = ['invalidation', 'write-through', 'cache-aside'];

const DISTRIBUTED_CACHE_RUBRIC: RubricSpec = {
  id: 'design-a-distributed-cache',
  title: 'Design a Distributed Cache — rubric',
  checks: [
    {
      id: 'cache-tier-redundant',
      label: 'Multiple cache nodes are present (the cluster itself)',
      max: 3,
      run: (g) =>
        redundancyEvidence(g, 'cache')
          ? { points: 3, verdict: 'pass', detail: 'Multiple cache nodes are shown.' }
          : { points: 0, verdict: 'fail', detail: 'A distributed cache IS the fleet of nodes — draw more than one cache node, not a single cache box.' },
    },
    {
      id: 'consistent-hashing',
      label: 'Consistent hashing (or a hash ring) is named for key placement',
      max: 3,
      run: (g) =>
        keywordAnywhere(g, CONSISTENT_HASHING_KEYWORDS)
          ? { points: 3, verdict: 'pass', detail: 'Consistent hashing is named.' }
          : {
              points: 0,
              verdict: 'fail',
              detail: 'Name how a key maps to a node (consistent hashing / a hash ring) — plain hash(key) % N reshuffles nearly everything the moment a node is added or removed.',
            },
    },
    {
      id: 'eviction-policy',
      label: 'An eviction policy is named',
      max: 2,
      run: (g) =>
        keywordAnywhere(g, EVICTION_KEYWORDS)
          ? { points: 2, verdict: 'pass', detail: 'An eviction policy is named.' }
          : { points: 0, verdict: 'fail', detail: 'Name how a node evicts under memory pressure (LRU, LFU, TTL).' },
    },
    {
      id: 'replication-named',
      label: 'Data is replicated for durability',
      max: 2,
      run: (g) =>
        keywordAnywhere(g, REPLICATION_KEYWORDS)
          ? { points: 2, verdict: 'pass', detail: 'Replication is named.' }
          : { points: 0, verdict: 'fail', detail: 'Say how a node\'s data survives that node dying (replication to one or more other nodes).' },
    },
    {
      id: 'client-routing',
      label: 'How a client finds the right node is named',
      max: 2,
      run: (g) =>
        keywordAnywhere(g, CLIENT_ROUTING_KEYWORDS)
          ? { points: 2, verdict: 'pass', detail: 'Client-side routing is named.' }
          : { points: 0, verdict: 'fail', detail: 'Say how a client (or a proxy) knows which node owns a given key — a smart client library with the cluster map, or a routing proxy.' },
    },
    {
      id: 'hot-key-handling',
      label: 'Hot-key mitigation is named',
      max: 3,
      run: (g) =>
        keywordAnywhere(g, HOT_KEY_KEYWORDS)
          ? { points: 3, verdict: 'pass', detail: 'Hot-key mitigation is named.' }
          : {
              points: 0,
              verdict: 'fail',
              detail: 'Uniform key placement doesn\'t protect against non-uniform traffic to one key — name how a hot key is detected and handled (replicating it onto extra nodes, or request coalescing).',
            },
    },
    {
      id: 'invalidation-named',
      label: 'A cache invalidation/write strategy is named',
      max: 2,
      run: (g) =>
        keywordAnywhere(g, INVALIDATION_KEYWORDS)
          ? { points: 2, verdict: 'pass', detail: 'An invalidation/write strategy is named.' }
          : { points: 0, verdict: 'fail', detail: 'Say what invalidates a cached value on a write (cache-aside, write-through) so staleness has a stated bound.' },
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

const STATEMENT = `Design a distributed, in-memory caching system (like Redis Cluster or a distributed Memcached deployment): many cache nodes together hold far more data than any single node's memory, and a client can find the right node for any key quickly.

Functional requirements:
- get(key) and set(key, value) route to whichever node owns that key.
- Adding or removing a cache node redistributes only a small fraction of keys, not most of them.
- The cluster survives losing any single node without losing all the data it held.

Non-functional requirements / scale:
- Terabytes of hot data spread across dozens of cache nodes.
- Sub-millisecond reads at the node level.
- A small number of extremely popular ("hot") keys can receive a disproportionate share of all traffic.`;

const REFERENCE_APPROACH = `Keys and nodes are placed on a consistent-hashing ring: each key maps to the first node clockwise from its hash position. This is the core design decision, because it means adding or removing a node only reshuffles the O(K/N) keys near that node on the ring, instead of nearly everything a naive hash(key) % N would. A client library (or a thin proxy layer) holds the current ring/cluster map and routes each request directly to the owning node, avoiding an extra network hop through a coordinator on every call. Each node evicts under memory pressure using LRU (or LFU), and each key can carry its own TTL. For durability, each node's data is replicated to one or two other nodes (typically async, trading a small replication lag for fast writes), so losing one physical node doesn't lose the data it held. Hot keys — a single key taking a disproportionate share of a node's traffic — are handled separately from the general ring: detect them by per-key access-count sampling at the node, then either replicate that specific key onto extra nodes or route reads for it through a request-coalescing layer that collapses concurrent misses into one backend fetch. Cache invalidation on a write follows an explicit policy (cache-aside with an app-level invalidation, or write-through) so staleness has a stated bound. The two things interviewers listen for: (1) consistent hashing specifically, not a naive modulo, and (2) an explicit hot-key mitigation, since uniform hashing alone doesn't protect against non-uniform traffic to one key.`;

export const DISTRIBUTED_CACHE: DesignProblem = {
  slug: 'design-a-distributed-cache',
  track: 'hld',
  title: 'Design a Distributed Cache',
  difficulty: 'Hard',
  statement: STATEMENT,
  rubric: DISTRIBUTED_CACHE_RUBRIC,
  referenceApproach: REFERENCE_APPROACH,
  hints: [
    'If you place keys with hash(key) % N and then add a node, how many keys have to move? What placement scheme minimizes that instead?',
    'One specific key can get far more traffic than every other key combined. What happens to the single node that owns it under a plain hashing scheme?',
    'Use consistent hashing (a hash ring) for placement so a node change only reshuffles a small fraction of keys, and detect/handle hot keys separately — by replicating just that key onto extra nodes or coalescing concurrent requests for it.',
  ],
};
