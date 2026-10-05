import { allNodesLabeled, edgeLabelMatches, hasDominantNode, hasRole, implementorCount, keywordAnywhere } from '../rubric/checks.ts';
import type { RubricSpec } from '../rubric/types.ts';
import type { DesignProblem } from '../types.ts';

/**
 * Probably the single most-asked LLD/machine-coding hybrid question. The
 * crux isn't polymorphism — it's naming the exact data-structure combination
 * that makes O(1) get/put possible. Reuses the same primitives regardless.
 */

const RELATIONSHIP_KEYWORDS = ['extends', 'implements', 'has-a', 'has a', 'uses', 'aggregates', 'composes'];

const LRU_CACHE_RUBRIC: RubricSpec = {
  id: 'design-an-lru-cache',
  title: 'Design an LRU Cache — rubric',
  checks: [
    {
      id: 'has-abstraction',
      label: 'A Cache/eviction-policy interface is present',
      max: 3,
      run: (g) =>
        hasRole(g, 'interface') || hasRole(g, 'abstractClass')
          ? { points: 3, verdict: 'pass', detail: 'A cache/eviction-policy abstraction is present.' }
          : { points: 0, verdict: 'fail', detail: 'Name a Cache or EvictionPolicy interface so LRU is one implementation, not the only possible one (an LFU cache should be able to slot in later without changing callers).' },
    },
    {
      id: 'policy-implemented',
      label: 'At least one concrete eviction policy implements the abstraction',
      max: 3,
      run: (g) => {
        const n = implementorCount(g, ['interface', 'abstractClass']);
        if (n >= 2) return { points: 3, verdict: 'pass', detail: `${n} concrete policies implement the abstraction.` };
        if (n === 1) return { points: 2, verdict: 'pass', detail: 'One concrete policy (e.g. LRU) implements the abstraction.' };
        return { points: 0, verdict: 'fail', detail: 'No concrete cache/policy class is wired to (implements/extends) the abstraction.' };
      },
    },
    {
      id: 'no-god-class',
      label: 'No single class does everything (a "god class")',
      max: 3,
      run: (g) =>
        hasDominantNode(g)
          ? { points: 0, verdict: 'fail', detail: 'One class accounts for a disproportionate share of the relationships here.' }
          : { points: 3, verdict: 'pass', detail: 'Responsibilities look reasonably distributed across classes.' },
    },
    {
      id: 'o1-data-structure',
      label: 'The O(1) data-structure combination is named',
      max: 3,
      run: (g) =>
        keywordAnywhere(g, ['doubly linked list', 'hashmap', 'hash map'])
          ? { points: 3, verdict: 'pass', detail: 'The hashmap + doubly-linked-list combination is named.' }
          : {
              points: 0,
              verdict: 'fail',
              detail: 'Name the specific data-structure pairing that makes O(1) get/put possible: a hashmap for O(1) lookup, combined with a doubly linked list for O(1) move-to-front and O(1) eviction of the tail. Neither alone gets you both operations at O(1).',
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
      id: 'capacity-eviction',
      label: 'A fixed capacity and its eviction trigger are named',
      max: 2,
      run: (g) =>
        keywordAnywhere(g, ['capacity', 'max size', 'evict when full'])
          ? { points: 2, verdict: 'pass', detail: 'Capacity and eviction trigger are named.' }
          : { points: 0, verdict: 'fail', detail: 'Name the fixed capacity and exactly what triggers an eviction (a put that would exceed capacity evicts the least-recently-used entry).' },
    },
    {
      id: 'thread-safety',
      label: 'Thread-safety for concurrent access is named',
      max: 2,
      run: (g) =>
        keywordAnywhere(g, ['thread-safe', 'thread safe', 'synchronized', 'lock', 'concurrent'])
          ? { points: 2, verdict: 'pass', detail: 'A thread-safety mechanism is named.' }
          : { points: 0, verdict: 'fail', detail: 'If this cache is shared across threads, say what guards the map-and-list mutations around get/put — a concurrent move-to-front during another thread\'s read can corrupt the list.' },
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

const STATEMENT = `Design the class structure for an LRU (Least Recently Used) cache: get(key) and put(key, value) must both run in O(1) time, and when the cache is full, the least-recently-used entry is evicted to make room for a new one.

Functional requirements:
- get(key): return the value if present, and mark it as most-recently-used.
- put(key, value): insert or update, and mark it as most-recently-used; if the cache is at capacity, evict the least-recently-used entry first.

Design expectations:
- Both operations must be O(1) — name the exact data structures that make that possible, not just "a cache."
- Design it so the eviction policy could be swapped for a different one (e.g. LFU) without rewriting the cache's public interface.
- Draw this as a class diagram: classes, interfaces, and typed relationships.`;

const REFERENCE_APPROACH = `Define a Cache (or EvictionPolicy) interface — get(key), put(key, value) — so the eviction strategy is swappable; LRUCache implements it today, and the same interface should accommodate an LFUCache later without changing any caller. Internally, LRUCache combines a HashMap<Key, Node> (O(1) lookup) with a doubly linked list of Nodes ordered by recency (O(1) move-to-front on every access, and O(1) eviction of the tail) — this specific pairing is the actual answer being checked for; a single data structure can't give O(1) for both lookup and recency-ordering on its own. A fixed capacity triggers eviction of the list's tail node whenever a put would exceed it. If the cache is accessed from multiple threads, the map-and-list mutations around get/put need to be guarded (a lock, or a concurrent-safe structure), since a concurrent move-to-front during another thread's read can corrupt the list.`;

export const LRU_CACHE: DesignProblem = {
  slug: 'design-an-lru-cache',
  track: 'lld',
  title: 'Design an LRU Cache',
  difficulty: 'Medium',
  statement: STATEMENT,
  rubric: LRU_CACHE_RUBRIC,
  referenceApproach: REFERENCE_APPROACH,
  hints: [
    'get() and put() both need to be O(1). A hashmap alone gives you O(1) lookup — what does it NOT give you?',
    'You also need O(1) "move this to most-recently-used" and O(1) "evict the least-recently-used." What structure lets you insert/remove at both ends in O(1)?',
    'Combine a HashMap (key -> node) with a doubly linked list ordered by recency — the map gives O(1) lookup, the list gives O(1) reordering and O(1) eviction of the tail.',
  ],
};
