import { allNodesLabeled, hasRole, keywordAnywhere, pathExists, redundancyEvidence } from '../rubric/checks.ts';
import type { RubricSpec } from '../rubric/types.ts';
import type { DesignProblem } from '../types.ts';

/**
 * A read-only, offline/online-split problem — unlike every other HLD problem
 * here, there is no meaningful write path on the request hot path at all,
 * which is exactly the point: all the ranking work happens offline.
 */

const TRIE_KEYWORDS = ['trie', 'prefix tree', 'prefix index'];
const RANKING_KEYWORDS = ['ranking', 'frequency', 'popularity score', 'top-k', 'top k'];
const OFFLINE_KEYWORDS = ['offline job', 'batch aggregation', 'periodic rebuild', 'map-reduce', 'nightly job', 'rolling window'];

const TYPEAHEAD_RUBRIC: RubricSpec = {
  id: 'design-a-typeahead-system',
  title: 'Design a Typeahead / Autocomplete System — rubric',
  checks: [
    {
      id: 'load-balancer',
      label: 'Load balancer in front of the suggestion service',
      max: 2,
      run: (g) => {
        if (pathExists(g, 'loadBalancer', 'appServer')) return { points: 2, verdict: 'pass', detail: 'A load balancer sits in front of the suggestion service.' };
        if (hasRole(g, 'loadBalancer')) return { points: 1, verdict: 'partial', detail: 'A load balancer is drawn but has no path into the suggestion service.' };
        return { points: 0, verdict: 'fail', detail: 'No load balancer in front of the suggestion service.' };
      },
    },
    {
      id: 'app-tier',
      label: 'A suggestion-service tier is present',
      max: 2,
      run: (g) => (hasRole(g, 'appServer') ? { points: 2, verdict: 'pass', detail: 'A suggestion service is present.' } : { points: 0, verdict: 'fail', detail: 'No suggestion-service tier drawn.' }),
    },
    {
      id: 'trie-index-named',
      label: 'A trie / prefix-index data structure is named',
      max: 3,
      run: (g) =>
        keywordAnywhere(g, TRIE_KEYWORDS)
          ? { points: 3, verdict: 'pass', detail: 'A trie/prefix-index structure is named.' }
          : { points: 0, verdict: 'fail', detail: 'Name the data structure that makes "find everything starting with this prefix" fast — a trie, with each node caching its own top-K completions.' },
    },
    {
      id: 'caching-hot-prefixes',
      label: 'A cache absorbs the skew toward a small number of hot prefixes',
      max: 3,
      run: (g) => {
        const wired = pathExists(g, 'appServer', 'cache');
        if (wired) return { points: 3, verdict: 'pass', detail: 'A cache sits on the suggestion read path.' };
        if (hasRole(g, 'cache')) return { points: 1, verdict: 'partial', detail: 'A cache is drawn but not wired to the suggestion service.' };
        return { points: 0, verdict: 'fail', detail: 'A small number of prefixes ("a", "ap", "app") get hit far more than most — cache them rather than re-walking the trie for every identical request.' };
      },
    },
    {
      id: 'ranking-named',
      label: 'A ranking/popularity signal is named',
      max: 2,
      run: (g) =>
        keywordAnywhere(g, RANKING_KEYWORDS)
          ? { points: 2, verdict: 'pass', detail: 'A ranking signal is named.' }
          : { points: 0, verdict: 'fail', detail: 'Say how completions are ranked (frequency/popularity, a top-K per node) — not just "the trie returns suggestions."' },
    },
    {
      id: 'offline-aggregation',
      label: 'An offline aggregation/rebuild job is named',
      max: 3,
      run: (g) =>
        keywordAnywhere(g, OFFLINE_KEYWORDS)
          ? { points: 3, verdict: 'pass', detail: 'An offline aggregation job is named.' }
          : {
              points: 0,
              verdict: 'fail',
              detail: 'Name the offline job that aggregates query logs and rebuilds the trie\'s rankings on a rolling window — without one, either every keystroke does ranking work, or rankings never reflect recent behavior.',
            },
    },
    {
      id: 'no-spof',
      label: 'No single point of failure across load balancer / suggestion service / cache',
      max: 3,
      run: (g) => {
        const tiers = ['loadBalancer', 'appServer', 'cache'] as const;
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

const STATEMENT = `Design a search-box autocomplete (typeahead) system: as a user types, suggest the most likely completions of their partial query, ranked by popularity, with very low latency.

Functional requirements:
- Given a prefix, return the top-K most popular completions.
- Suggestions should reflect roughly-recent popularity — a fad from last month shouldn't outrank this week's trending query forever.
- A completely new query should eventually start showing up in suggestions as it gains popularity.

Non-functional requirements / scale:
- Suggest traffic runs several times higher than actual search traffic — hundreds of thousands of requests per second at peak.
- Each keystroke should get a response well under 100ms.
- No per-keystroke request should do meaningful ranking work — that happens offline.`;

const REFERENCE_APPROACH = `Autocomplete splits into two systems meeting at a trie. Offline, a batch aggregation job (recomputed on a rolling window — the last 24 hours or 7 days — so old fads decay) processes query logs into a popularity score per query string, and rebuilds a trie where every node caches its own sorted top-K completions. That trie is loaded into memory by a fleet of suggestion-service instances behind a load balancer; a keystroke request walks the trie to the prefix node and returns its precomputed top-K — an O(len(prefix)) memory lookup with zero ranking work on the read path. A cache (often a short-TTL cache in front of, or inside, the suggestion service) absorbs the extreme skew in real traffic, since a small number of prefixes ("a", "ap", "app") get hit disproportionately. Sharding the trie by prefix range (A-G, H-N, O-Z) across replicas lets it scale horizontally once a single node's memory or QPS ceiling is hit. Redundancy across the load balancer, suggestion-service tier, and cache. The two things interviewers listen for: (1) the offline/online split — no per-keystroke ranking work — and (2) a rolling-window recomputation so rankings actually reflect recent behavior instead of freezing forever.`;

export const TYPEAHEAD_SYSTEM: DesignProblem = {
  slug: 'design-a-typeahead-system',
  track: 'hld',
  title: 'Design a Typeahead / Autocomplete System',
  difficulty: 'Medium',
  statement: STATEMENT,
  rubric: TYPEAHEAD_RUBRIC,
  referenceApproach: REFERENCE_APPROACH,
  hints: [
    'Ranking every possible completion on every keystroke would be far too slow. What if almost all of the work happened before the request even arrives?',
    'A user types one character at a time — what data structure makes "find everything starting with this prefix" fast?',
    'Build a trie offline from aggregated query logs, cache each node\'s top-K completions, and serve keystrokes as a pure in-memory trie lookup — recompute the trie periodically so rankings reflect recent (not permanent) popularity.',
  ],
};
