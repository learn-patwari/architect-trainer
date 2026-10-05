import { allNodesLabeled, keywordAnywhere, redundancyEvidence } from '../rubric/checks.ts';
import type { RubricSpec } from '../rubric/types.ts';
import type { DesignProblem } from '../types.ts';

/**
 * The Dynamo/Cassandra-shaped problem: a leaderless, AP-leaning store you
 * design yourself, as opposed to distributed-cache.ts (an ephemeral,
 * ok-to-lose cache layer) — durability and conflict resolution are the crux
 * here, not eviction policy.
 */

const HASHING_KEYWORDS = ['consistent hashing', 'hash ring'];
const QUORUM_KEYWORDS = ['quorum', 'w + r', 'w+r', 'read repair'];
const CONFLICT_KEYWORDS = ['vector clock', 'version vector', 'last-write-wins', 'lww'];
const REPLICATION_KEYWORDS = ['replica', 'preference list', 'n replicas'];
const WAL_KEYWORDS = ['write-ahead log', 'wal', 'commit log'];
const ANTI_ENTROPY_KEYWORDS = ['merkle tree', 'anti-entropy', 'read repair'];
const MEMBERSHIP_KEYWORDS = ['gossip', 'membership'];

const DISTRIBUTED_KV_STORE_RUBRIC: RubricSpec = {
  id: 'design-a-distributed-key-value-store',
  title: 'Design a Distributed Key-Value Store — rubric',
  checks: [
    {
      id: 'partitioning-named',
      label: 'Consistent hashing is named for partitioning',
      max: 3,
      run: (g) =>
        keywordAnywhere(g, HASHING_KEYWORDS)
          ? { points: 3, verdict: 'pass', detail: 'Consistent hashing is named for placement.' }
          : { points: 0, verdict: 'fail', detail: 'Name how a key maps to a node — consistent hashing (a ring), so adding/removing a node doesn\'t reshuffle almost everything.' },
    },
    {
      id: 'replication-named',
      label: 'Data is replicated to N nodes',
      max: 3,
      run: (g) =>
        keywordAnywhere(g, REPLICATION_KEYWORDS) || redundancyEvidence(g, 'datastore')
          ? { points: 3, verdict: 'pass', detail: 'Replication across nodes is named or shown.' }
          : { points: 0, verdict: 'fail', detail: 'Say how many replicas each key has and where they live (the next N-1 nodes on the ring).' },
    },
    {
      id: 'quorum-named',
      label: 'Quorum reads/writes (W + R > N) are named',
      max: 3,
      run: (g) =>
        keywordAnywhere(g, QUORUM_KEYWORDS)
          ? { points: 3, verdict: 'pass', detail: 'A quorum scheme is named.' }
          : {
              points: 0,
              verdict: 'fail',
              detail: 'Say how many replicas must ack a write (W) and be read (R) for a read to see the latest write, without a single leader — W + R > N.',
            },
    },
    {
      id: 'conflict-resolution',
      label: 'A conflict-resolution strategy is named',
      max: 3,
      run: (g) =>
        keywordAnywhere(g, CONFLICT_KEYWORDS)
          ? { points: 3, verdict: 'pass', detail: 'A conflict-resolution strategy is named.' }
          : {
              points: 0,
              verdict: 'fail',
              detail: 'Quorum guarantees a read overlaps the latest ACKNOWLEDGED write, not that concurrent writes are ordered — name how two concurrent writes to the same key are reconciled (vector clocks, or simple last-write-wins).',
            },
    },
    {
      id: 'durability-named',
      label: 'Writes are durable before acknowledging (a write-ahead log)',
      max: 2,
      run: (g) =>
        keywordAnywhere(g, WAL_KEYWORDS)
          ? { points: 2, verdict: 'pass', detail: 'A write-ahead/commit log is named.' }
          : { points: 0, verdict: 'fail', detail: 'Say how a single node makes a write durable before acknowledging it (append to a write-ahead log before updating the in-memory structure).' },
    },
    {
      id: 'anti-entropy-named',
      label: 'Replicas are reconciled in the background (anti-entropy)',
      max: 2,
      run: (g) =>
        keywordAnywhere(g, ANTI_ENTROPY_KEYWORDS)
          ? { points: 2, verdict: 'pass', detail: 'An anti-entropy mechanism is named.' }
          : {
              points: 0,
              verdict: 'fail',
              detail: 'Say how replicas that missed a write (a node that was down) catch back up — read repair on the next read, or a background Merkle-tree comparison between replicas.',
            },
    },
    {
      id: 'membership-named',
      label: 'How nodes learn about cluster membership is named',
      max: 1,
      run: (g) =>
        keywordAnywhere(g, MEMBERSHIP_KEYWORDS)
          ? { points: 1, verdict: 'pass', detail: 'A membership mechanism is named.' }
          : { points: 0, verdict: 'fail', detail: 'Say how a node learns which other nodes are alive and where they sit on the ring (a gossip protocol).' },
    },
    {
      id: 'all-labeled',
      label: 'Every node is labeled',
      max: 3,
      run: (g) => {
        const { labeled, total } = allNodesLabeled(g);
        if (total === 0) return { points: 0, verdict: 'fail', detail: 'Nothing drawn yet.' };
        const points = Math.round((3 * labeled) / total);
        const verdict = labeled === total ? 'pass' : labeled === 0 ? 'fail' : 'partial';
        return { points, verdict, detail: labeled === total ? 'Every shape is labeled.' : `${total - labeled} shape(s) have no label.` };
      },
    },
  ],
};

const STATEMENT = `Design a distributed, leaderless key-value store — the shape of Amazon's Dynamo, Cassandra, or Riak — that stays available for reads and writes even when some nodes are down or unreachable.

Functional requirements:
- put(key, value) and get(key), served by any node in the cluster, not a single elected leader.
- The store stays writable even during a network partition that isolates part of the cluster (availability over strict consistency).
- Data survives losing any single node.

Non-functional requirements / scale:
- Hundreds of nodes, spread across multiple data centers.
- Low-latency reads and writes (single-digit milliseconds), tunable per operation.`;

const REFERENCE_APPROACH = `Keys are placed on a consistent-hashing ring with virtual nodes, and each key is replicated to the next N-1 distinct physical nodes walking clockwise from its position (its preference list) — the same partitioning/replication scheme as this app's own consistent-hashing and quorum concepts. Because there's no leader, a write is acknowledged once W replicas confirm it, and a read queries R replicas and returns the most recent version, with W + R > N guaranteeing the read set and write set always overlap by at least one replica. That guarantee is about seeing the latest ACKNOWLEDGED write, not about ordering concurrent writes to the same key — two clients writing to the same key at nearly the same time can both succeed without ever seeing each other, so each version carries a vector clock (or, more simply, a timestamp for last-write-wins) letting the store — or, for a genuine conflict, the application — reconcile the two versions on a later read. Each node makes a write durable by appending it to a local write-ahead log before applying it to its in-memory structure, so a crash doesn't lose acknowledged writes. Replicas that missed writes while down catch back up via anti-entropy: read repair (a stale replica is corrected the next time it's read) and a background process that compares Merkle trees between replicas to find and repair divergence without transferring the entire dataset. Cluster membership itself — which nodes exist, and where — propagates via a gossip protocol, where each node periodically exchanges its view of the cluster with a few random peers rather than relying on a single coordinator.`;

export const DISTRIBUTED_KEY_VALUE_STORE: DesignProblem = {
  slug: 'design-a-distributed-key-value-store',
  track: 'hld',
  title: 'Design a Distributed Key-Value Store',
  difficulty: 'Hard',
  statement: STATEMENT,
  rubric: DISTRIBUTED_KV_STORE_RUBRIC,
  referenceApproach: REFERENCE_APPROACH,
  hints: [
    'With no leader, how many replicas need to acknowledge a write, and how many need to be read, for a read to be guaranteed to see the latest acknowledged write?',
    'Two clients write to the same key at nearly the same instant, on two different replicas, with no leader to serialize them. What happens, and how does the store ever reconcile it?',
    'Use consistent hashing with replication to N nodes, quorum reads/writes (W + R > N) for read-your-writes behavior, vector clocks (or last-write-wins) for concurrent-write conflicts, and background anti-entropy (Merkle trees / read repair) to catch replicas back up.',
  ],
};
