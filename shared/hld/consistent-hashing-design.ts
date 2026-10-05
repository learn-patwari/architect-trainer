import { allNodesLabeled, keywordAnywhere, redundancyEvidence } from '../rubric/checks.ts';
import type { RubricSpec } from '../rubric/types.ts';
import type { DesignProblem } from '../types.ts';

/**
 * ByteByteGo's own standalone "Design Consistent Hashing" chapter: the
 * mechanism itself as the answer, not a supporting detail inside a bigger
 * system (contrast with distributed-cache.ts, which uses this mechanism but
 * is scored on the cache's other concerns too).
 */

const RING_KEYWORDS = ['hash ring', 'ring', 'consistent hashing'];
const VIRTUAL_NODE_KEYWORDS = ['virtual node', 'vnode', 'v-node'];
const REBALANCE_KEYWORDS = ['minimal data movement', 'only its neighbor', 'small fraction', 'rebalance'];
const MEMBERSHIP_KEYWORDS = ['gossip', 'zookeeper', 'membership', 'heartbeat', 'node join', 'node leave'];
const HOTSPOT_KEYWORDS = ['skew', 'hot spot', 'hotspot', 'uneven'];
const REPLICATION_KEYWORDS = ['replica', 'replication', 'n replicas', 'preference list'];

const CONSISTENT_HASHING_RUBRIC: RubricSpec = {
  id: 'design-consistent-hashing',
  title: 'Design Consistent Hashing — rubric',
  checks: [
    {
      id: 'ring-named',
      label: 'A hash ring (not modulo hashing) is named',
      max: 3,
      run: (g) =>
        keywordAnywhere(g, RING_KEYWORDS)
          ? { points: 3, verdict: 'pass', detail: 'A hash ring is named.' }
          : { points: 0, verdict: 'fail', detail: 'Name the ring structure explicitly — nodes and keys hashed onto the same circular space, each key owned by the next node clockwise.' },
    },
    {
      id: 'rebalance-explained',
      label: 'Minimal data movement on node change is explained',
      max: 3,
      run: (g) =>
        keywordAnywhere(g, REBALANCE_KEYWORDS)
          ? { points: 3, verdict: 'pass', detail: 'Minimal-movement behavior on node change is named.' }
          : {
              points: 0,
              verdict: 'fail',
              detail: 'State the actual payoff: adding or removing a node only reshuffles the keys near it on the ring, not nearly everything — this is the entire reason the mechanism exists over hash(key) % N.',
            },
    },
    {
      id: 'virtual-nodes',
      label: 'Virtual nodes are named for load distribution',
      max: 3,
      run: (g) =>
        keywordAnywhere(g, VIRTUAL_NODE_KEYWORDS)
          ? { points: 3, verdict: 'pass', detail: 'Virtual nodes are named.' }
          : {
              points: 0,
              verdict: 'fail',
              detail: 'A plain ring with few real servers can land unevenly, hot-spotting one node — name virtual nodes (many ring positions per physical node) as the fix.',
            },
    },
    {
      id: 'hotspot-awareness',
      label: 'Uneven load / hotspot risk is called out',
      max: 2,
      run: (g) =>
        keywordAnywhere(g, HOTSPOT_KEYWORDS)
          ? { points: 2, verdict: 'pass', detail: 'Skew/hotspot risk is called out.' }
          : { points: 0, verdict: 'fail', detail: 'Name the risk virtual nodes are actually solving: without them, a small number of real servers can land unevenly on the ring and one takes a disproportionate share of keys.' },
    },
    {
      id: 'replication-named',
      label: 'Data is replicated to N successor nodes on the ring',
      max: 3,
      run: (g) =>
        keywordAnywhere(g, REPLICATION_KEYWORDS)
          ? { points: 3, verdict: 'pass', detail: 'Replication to successor nodes is named.' }
          : {
              points: 0,
              verdict: 'fail',
              detail: 'Say how a key survives its owning node dying — replicate it to the next N-1 distinct physical nodes walking clockwise from its position on the ring.',
            },
    },
    {
      id: 'membership-named',
      label: 'How nodes learn about ring membership changes is named',
      max: 2,
      run: (g) =>
        keywordAnywhere(g, MEMBERSHIP_KEYWORDS)
          ? { points: 2, verdict: 'pass', detail: 'A membership-propagation mechanism is named.' }
          : { points: 0, verdict: 'fail', detail: 'Say how a node joining or leaving is actually detected and propagated to the rest of the cluster (gossip, a coordination service like ZooKeeper).' },
    },
    {
      id: 'nodes-redundant',
      label: 'More than one node is drawn (it is a ring, not one box)',
      max: 2,
      run: (g) => {
        const anyRole = ['cache', 'datastore', 'appServer'] as const;
        const ok = anyRole.some((r) => redundancyEvidence(g, r));
        return ok
          ? { points: 2, verdict: 'pass', detail: 'Multiple nodes are shown.' }
          : { points: 0, verdict: 'fail', detail: 'Draw the ring as more than one node — the whole point of this problem is what happens across several of them.' };
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

const STATEMENT = `Design a consistent-hashing scheme for distributing keys (or cache entries, or shards) across a cluster of nodes, so that adding or removing a node reshuffles only a small fraction of the keys instead of nearly all of them.

Functional requirements:
- Map any key deterministically to one owning node.
- When a node is added or removed, only the keys near that node on the mapping should move — not a majority of all keys.
- Every node should end up owning a roughly equal share of the key space, even with a small number of real servers.

Non-functional requirements / scale:
- Hundreds to thousands of nodes joining and leaving over the cluster's lifetime (autoscaling, failures, planned maintenance).
- Lookups must be fast (no coordinator round trip needed to find a key's owner).`;

const REFERENCE_APPROACH = `Hash both nodes and keys onto the same fixed circular space (a hash ring) using the same hash function, and assign each key to the next node clockwise from its position. This bounds the blast radius of any single node change: adding or removing one node only affects the keys between it and its immediate neighbor on the ring, leaving every other node's keys untouched — the entire reason this beats a naive hash(key) % N, where changing N reshuffles almost everything. A plain ring with only a handful of real nodes can still land unevenly by chance, hot-spotting one node with a disproportionate share of keys — the fix is virtual nodes: each physical node gets many positions on the ring (e.g. 100–256), smoothing the distribution and, as a side effect, spreading a failed node's keys across many survivors instead of dumping them all on one neighbor. For durability, each key is replicated to the next N-1 DISTINCT physical nodes walking clockwise from its primary position (a preference list), so a single node failure doesn't lose data, only that node's share of primary ownership. Ring membership changes (a node joining, leaving, or dying) are detected and propagated to the rest of the cluster via a gossip protocol (each node periodically exchanges its view of membership with a few random peers) or a coordination service like ZooKeeper/etcd, rather than every node needing a synchronous broadcast on every change.`;

export const CONSISTENT_HASHING_DESIGN: DesignProblem = {
  slug: 'design-consistent-hashing',
  track: 'hld',
  title: 'Design Consistent Hashing',
  difficulty: 'Medium',
  statement: STATEMENT,
  rubric: CONSISTENT_HASHING_RUBRIC,
  referenceApproach: REFERENCE_APPROACH,
  hints: [
    'With hash(key) % N, what happens to almost every key\'s assignment the moment N changes by just one? What structure avoids that?',
    'A ring with only 5 real servers can land unevenly by chance, dumping a disproportionate share of keys on one of them. What do real systems (Cassandra, Dynamo) add per physical node to fix that?',
    'Hash nodes and keys onto the same ring, assign each key to the next node clockwise, give each physical node many virtual positions on the ring for even load, and replicate each key to the next N-1 distinct nodes for durability.',
  ],
};
