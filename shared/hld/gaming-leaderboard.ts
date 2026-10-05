import { allNodesLabeled, hasRole, keywordAnywhere, pathExists, redundancyEvidence } from '../rubric/checks.ts';
import type { RubricSpec } from '../rubric/types.ts';
import type { DesignProblem } from '../types.ts';

/**
 * A real-time ranking problem: the crux is an ordered, frequently-updated
 * rank structure (a sorted set) rather than an ORDER BY query on every
 * score update — sorting at write time, not query time.
 */

const SORTED_SET_KEYWORDS = ['sorted set', 'redis sorted set', 'skip list', 'zset'];
const SHARDING_KEYWORDS = ['shard the leaderboard', 'per-game shard', 'leaderboard shard'];
const RANK_AGGREGATE_KEYWORDS = ['aggregate ranks', 'merge shards', 'combine shards'];
const WRITE_THROUGH_KEYWORDS = ['write-through', 'async persist', 'periodic snapshot', 'persisted async'];
const RANGE_QUERY_KEYWORDS = ['top-k', 'top k', 'rank range', 'zrange', 'rank near me'];
const TIE_BREAK_KEYWORDS = ['tiebreak', 'tie-break', 'tie break'];

const GAMING_LEADERBOARD_RUBRIC: RubricSpec = {
  id: 'design-a-real-time-gaming-leaderboard',
  title: 'Design a Real-time Gaming Leaderboard — rubric',
  checks: [
    {
      id: 'sorted-structure-named',
      label: 'A sorted/ordered data structure (not ORDER BY on write) backs ranking',
      max: 4,
      run: (g) =>
        keywordAnywhere(g, SORTED_SET_KEYWORDS)
          ? { points: 4, verdict: 'pass', detail: 'A sorted-set-style structure is named.' }
          : {
              points: 0,
              verdict: 'fail',
              detail: 'Re-sorting a full table on every score update doesn\'t scale — name a structure that keeps itself ordered as scores change (a Redis sorted set / skip list), so rank queries are fast without a sort at read time.',
            },
    },
    {
      id: 'in-memory-tier',
      label: 'The active leaderboard lives in a fast, in-memory tier',
      max: 2,
      run: (g) =>
        hasRole(g, 'cache')
          ? { points: 2, verdict: 'pass', detail: 'An in-memory tier is present.' }
          : { points: 0, verdict: 'fail', detail: 'Score updates and rank lookups both need to be fast and frequent — hold the live leaderboard in an in-memory store, not query a durable database on every update.' },
    },
    {
      id: 'persistence-async',
      label: 'The in-memory leaderboard is persisted asynchronously, not on every write',
      max: 3,
      run: (g) =>
        keywordAnywhere(g, WRITE_THROUGH_KEYWORDS)
          ? { points: 3, verdict: 'pass', detail: 'Async persistence is named.' }
          : {
              points: 0,
              verdict: 'fail',
              detail: 'An in-memory-only leaderboard loses all rankings on a crash — name how it\'s durably backed up (async persistence, periodic snapshotting) without every score update paying a synchronous durable-write cost.',
            },
    },
    {
      id: 'range-query-support',
      label: 'Efficient top-K and "rank near me" queries are named',
      max: 3,
      run: (g) =>
        keywordAnywhere(g, RANGE_QUERY_KEYWORDS)
          ? { points: 3, verdict: 'pass', detail: 'Range-query support is named.' }
          : {
              points: 0,
              verdict: 'fail',
              detail: 'The two real queries are "show me the top 10" and "show me my rank and the players around me" — name the operation that answers both without scanning the whole leaderboard.',
            },
    },
    {
      id: 'sharding-for-scale',
      label: 'The leaderboard is sharded at very large scale, with an explicit merge step',
      max: 3,
      run: (g) =>
        keywordAnywhere(g, SHARDING_KEYWORDS) && keywordAnywhere(g, RANK_AGGREGATE_KEYWORDS)
          ? { points: 3, verdict: 'pass', detail: 'Sharding with a merge/aggregation step is named.' }
          : {
              points: 0,
              verdict: 'fail',
              detail: 'A single sorted-set node has a ceiling on player count — name sharding the leaderboard (e.g. by player-ID range) plus how a global top-K is computed by merging results across shards.',
            },
    },
    {
      id: 'tie-breaking',
      label: 'A tie-breaking rule for equal scores is named',
      max: 1,
      run: (g) =>
        keywordAnywhere(g, TIE_BREAK_KEYWORDS)
          ? { points: 1, verdict: 'pass', detail: 'A tie-breaking rule is named.' }
          : { points: 0, verdict: 'fail', detail: 'Say how a tie in score is broken (e.g. whoever reached that score first) — "rank" is ambiguous without one.' },
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

const STATEMENT = `Design a real-time leaderboard for an online game: players' scores update constantly, and the system serves "top 10 players" and "my current rank" queries with low latency.

Functional requirements:
- updateScore(playerId, score) updates a player's score, reflected in their rank essentially immediately.
- getTopK(k) returns the top K players by score.
- getRank(playerId) returns a player's current rank and the players immediately above/below them.

Non-functional requirements / scale:
- Tens of millions of active players, with score updates happening constantly across all of them.
- Rank queries must be low-latency even while updates are streaming in continuously.
- The leaderboard must not lose all rankings if the serving tier restarts.`;

const REFERENCE_APPROACH = `Re-sorting a table on every score update doesn't scale, so ranking is backed by a structure that stays sorted as it's updated — a Redis sorted set (backed by a skip list) is the canonical real-world choice: an update is O(log n), and both getTopK (a range query over the sorted set) and getRank (an O(log n) rank lookup, plus a small range around it for "players near me") are fast without ever re-sorting anything. This lives in an in-memory tier for both update and query speed, not a durable database queried on every request. Because an in-memory-only structure loses everything on a crash, it's backed by asynchronous persistence — periodic snapshotting, or an append-only log of updates replayed on restart — rather than every single score update paying a synchronous durable-write cost, which would defeat the point of using an in-memory structure at all. At tens of millions of concurrent players, a single sorted-set instance has a real ceiling, so the leaderboard is sharded (commonly by player-ID range or a consistent hash), with each shard maintaining its own local ranking; a global getTopK merges the top-K candidates from every shard (each shard only needs to return its own local top-K, since a player outside a shard's local top-K can't be in the global top-K either) rather than needing one node holding every player. A tie in score is broken by an explicit secondary rule (commonly whoever reached that score first), since "rank" is otherwise ambiguous for equal scores. The API/game-server tier consuming this leaderboard service sits behind a load balancer, horizontally scaled like any other stateless app tier.`;

export const GAMING_LEADERBOARD: DesignProblem = {
  slug: 'design-a-real-time-gaming-leaderboard',
  track: 'hld',
  title: 'Design a Real-time Gaming Leaderboard',
  difficulty: 'Medium',
  statement: STATEMENT,
  rubric: GAMING_LEADERBOARD_RUBRIC,
  referenceApproach: REFERENCE_APPROACH,
  hints: [
    'If a score update triggered an ORDER BY over every player\'s score, what happens to that query\'s cost as the player count grows? What structure stays sorted incrementally instead?',
    'A single node holding a sorted structure for tens of millions of players has a real ceiling. If you shard the leaderboard, how do you still answer "give me the global top 10"?',
    'Back the live leaderboard with an in-memory sorted-set structure (Redis) for O(log n) updates and rank queries, persist it asynchronously for durability, and shard it at large scale with a merge step across shards for a global top-K.',
  ],
};
