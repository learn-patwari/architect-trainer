import { allNodesLabeled, keywordAnywhere, redundancyEvidence } from '../rubric/checks.ts';
import type { RubricSpec } from '../rubric/types.ts';
import type { DesignProblem } from '../types.ts';

/**
 * "Build a Kafka," not "use a Kafka": the crux is partitioning a topic for
 * throughput, replicating each partition for durability, and consumer
 * groups/offsets for at-least-once delivery — the mechanism, not the app
 * that happens to use a queue.
 */

const PARTITION_KEYWORDS = ['partition', 'shard the topic'];
const REPLICATION_KEYWORDS = ['replica', 'replication factor', 'leader replica', 'follower replica', 'isr', 'in-sync replica'];
const OFFSET_KEYWORDS = ['offset', 'consumer group'];
const ORDERING_KEYWORDS = ['ordering', 'ordered within a partition', 'per-partition order'];
const DURABILITY_KEYWORDS = ['append-only log', 'commit log', 'write-ahead log', 'disk-backed'];
const ACK_KEYWORDS = ['ack', 'acknowledgment', 'at-least-once', 'delivery semantics'];
const COORDINATION_KEYWORDS = ['zookeeper', 'raft', 'controller', 'kraft'];

const DISTRIBUTED_MESSAGE_QUEUE_RUBRIC: RubricSpec = {
  id: 'design-a-distributed-message-queue',
  title: 'Design a Distributed Message Queue — rubric',
  checks: [
    {
      id: 'partitioning-named',
      label: 'A topic is partitioned for parallel throughput',
      max: 3,
      run: (g) =>
        keywordAnywhere(g, PARTITION_KEYWORDS)
          ? { points: 3, verdict: 'pass', detail: 'Partitioning is named.' }
          : { points: 0, verdict: 'fail', detail: 'A single-partition topic caps throughput at one broker\'s capacity — name splitting a topic into partitions, spread across brokers, for parallel writes and reads.' },
    },
    {
      id: 'replication-named',
      label: 'Each partition is replicated across brokers',
      max: 3,
      run: (g) =>
        keywordAnywhere(g, REPLICATION_KEYWORDS) || redundancyEvidence(g, 'queue')
          ? { points: 3, verdict: 'pass', detail: 'Partition replication is named or shown.' }
          : { points: 0, verdict: 'fail', detail: 'Say how a partition survives its broker dying — replicate each partition (a leader plus follower replicas) across multiple brokers.' },
    },
    {
      id: 'durable-log',
      label: 'Messages are durably appended to an on-disk log',
      max: 2,
      run: (g) =>
        keywordAnywhere(g, DURABILITY_KEYWORDS)
          ? { points: 2, verdict: 'pass', detail: 'A durable append-only log is named.' }
          : { points: 0, verdict: 'fail', detail: 'Say how a message survives a broker restart — appended to an on-disk, append-only log, not held only in memory.' },
    },
    {
      id: 'ordering-scope',
      label: 'Ordering is scoped to within a partition, not the whole topic',
      max: 3,
      run: (g) =>
        keywordAnywhere(g, ORDERING_KEYWORDS)
          ? { points: 3, verdict: 'pass', detail: 'Per-partition ordering is named.' }
          : {
              points: 0,
              verdict: 'fail',
              detail: 'Say explicitly that ordering is guaranteed only WITHIN a partition (same key -> same partition), not across the whole topic — a common wrong assumption to leave unstated.',
            },
    },
    {
      id: 'consumer-offsets',
      label: 'Consumer offsets/groups track delivery progress',
      max: 3,
      run: (g) =>
        keywordAnywhere(g, OFFSET_KEYWORDS)
          ? { points: 3, verdict: 'pass', detail: 'Consumer offsets/groups are named.' }
          : { points: 0, verdict: 'fail', detail: 'Say how a consumer tracks what it has already processed (a committed offset per partition), and how a consumer group divides partitions among its members.' },
    },
    {
      id: 'delivery-semantics',
      label: 'Delivery semantics (at-least-once) are named',
      max: 2,
      run: (g) =>
        keywordAnywhere(g, ACK_KEYWORDS)
          ? { points: 2, verdict: 'pass', detail: 'Delivery semantics are named.' }
          : { points: 0, verdict: 'fail', detail: 'Name the delivery guarantee this design actually provides (at-least-once is the realistic default) and what that implies for consumers.' },
    },
    {
      id: 'coordination-named',
      label: 'Broker/partition-leader coordination is named',
      max: 2,
      run: (g) =>
        keywordAnywhere(g, COORDINATION_KEYWORDS)
          ? { points: 2, verdict: 'pass', detail: 'A coordination mechanism is named.' }
          : { points: 0, verdict: 'fail', detail: 'Say how the cluster agrees on which replica is the leader for each partition (a controller elected via ZooKeeper/Raft, or Kafka\'s own KRaft).' },
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

const STATEMENT = `Design a distributed message queue — the mechanism itself, in the shape of Kafka — not a system that merely uses one.

Functional requirements:
- Producers publish messages to a named topic; consumers read them back, in order, on a per-key basis.
- A topic must sustain far more throughput than a single machine's disk/network can handle.
- A message survives a broker crashing after it was published but before every consumer read it.

Non-functional requirements / scale:
- Millions of messages per second across all topics.
- Consumers process independently and at their own pace — a slow consumer shouldn't block a fast one on a different partition.
- The system must keep accepting writes even if a single broker goes down.`;

const REFERENCE_APPROACH = `A topic is split into partitions, each an append-only, ordered, on-disk log — this is what lets a topic's total throughput scale by adding partitions spread across more brokers, since each partition can be written and read independently. Each partition is replicated across multiple brokers (one leader replica that serves reads/writes, and follower replicas that continuously copy from it), so losing the leader's broker triggers a follower to take over rather than losing the partition's data. Ordering is guaranteed only WITHIN a partition — a producer routes messages with the same key to the same partition (by hashing the key) to get per-key ordering, but there's no guarantee across different partitions of the same topic, which is a real, easy-to-miss caveat worth stating explicitly. Consumers are organized into consumer groups: each partition is assigned to exactly one consumer within a group, so a group's total read throughput scales with partition count, and each consumer tracks its own committed offset (how far it's read) per partition, so a restart resumes from where it left off instead of from the beginning. This delivery model is realistically at-least-once — a consumer that crashes after processing a message but before committing its offset will reprocess it on restart, which is why consumers need to be idempotent. Which broker is the leader for each partition is agreed on by the cluster's own coordination layer (historically ZooKeeper electing a controller; modern Kafka uses its own Raft-based KRaft protocol instead) rather than any single broker unilaterally deciding.`;

export const DISTRIBUTED_MESSAGE_QUEUE: DesignProblem = {
  slug: 'design-a-distributed-message-queue',
  track: 'hld',
  title: 'Design a Distributed Message Queue',
  difficulty: 'Hard',
  statement: STATEMENT,
  rubric: DISTRIBUTED_MESSAGE_QUEUE_RUBRIC,
  referenceApproach: REFERENCE_APPROACH,
  hints: [
    'A single-partition topic caps total throughput at whatever one broker can handle. What structural change lets throughput scale by adding more brokers?',
    'Is ordering guaranteed across the entire topic, or only within a smaller unit? What does that mean for how a producer should route related messages?',
    'Partition the topic for parallel throughput, replicate each partition across brokers for durability, scope ordering to within a partition (route by key), and track per-partition consumer offsets for at-least-once delivery.',
  ],
};
