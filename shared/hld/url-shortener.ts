import { allNodesLabeled, hasRole, keywordAnywhere, nodesWithRole, normalize, pathExists, redundancyEvidence } from '../rubric/checks.ts';
import type { RubricSpec } from '../rubric/types.ts';
import type { DesignProblem } from '../types.ts';

/**
 * The one HLD problem in this v1 slice. This file — and shared/rubric, shared/scene —
 * is the answer-key layer: imported by server/ only, never by web/src. The rubric
 * checks are structural (does the diagram show the right shape), not a semantic
 * judge of the design; the AI review layer is where deeper judgment calls belong.
 */

const SPECIFIC_DATASTORE_KEYWORDS = [
  'postgres', 'mysql', 'dynamodb', 'cassandra', 'mongodb', 'cockroachdb', 'sqlite',
  'maria', 'aurora', 'spanner', 'key-value', 'kv store', 'redis',
];

const ID_STRATEGY_KEYWORDS = [
  'base62', 'base-62', 'base 62', 'counter', 'snowflake', 'zookeeper', 'uuid', 'md5', 'random string', 'auto-increment',
];

const SHARD_KEY_KEYWORDS = ['shard key', 'sharding key', 'partition key', 'shard by', 'partitioned by', 'hash of the code', 'hash(code)'];

const URL_SHORTENER_RUBRIC: RubricSpec = {
  id: 'design-a-url-shortener',
  title: 'Design a URL Shortener — rubric',
  checks: [
    {
      id: 'load-balancer',
      label: 'Load balancer in front of the app tier',
      max: 3,
      run: (g) => {
        if (pathExists(g, 'loadBalancer', 'appServer')) {
          return { points: 3, verdict: 'pass', detail: 'A load balancer sits in front of the app tier.' };
        }
        if (hasRole(g, 'loadBalancer')) {
          return { points: 1, verdict: 'partial', detail: 'A load balancer is drawn but has no path into the app tier — connect it.' };
        }
        return { points: 0, verdict: 'fail', detail: 'No load balancer in front of the app tier.' };
      },
    },
    {
      id: 'app-tier',
      label: 'Application / API tier present',
      max: 2,
      run: (g) =>
        hasRole(g, 'appServer')
          ? { points: 2, verdict: 'pass', detail: 'An app/API tier is present.' }
          : { points: 0, verdict: 'fail', detail: 'No app/API server tier drawn.' },
    },
    {
      id: 'datastore-named',
      label: 'Datastore present and a specific technology named',
      max: 3,
      run: (g) => {
        const stores = nodesWithRole(g, 'datastore');
        if (stores.length === 0) return { points: 0, verdict: 'fail', detail: 'No datastore drawn.' };
        const specific = stores.some((n) => SPECIFIC_DATASTORE_KEYWORDS.some((k) => normalize(n.label).includes(k)));
        return specific
          ? { points: 3, verdict: 'pass', detail: 'A specific datastore technology is named.' }
          : {
              points: 1,
              verdict: 'partial',
              detail: 'A datastore is drawn but only labeled "database"/"DB" — name the actual technology and why it fits (key lookups by code).',
            };
      },
    },
    {
      id: 'cache-on-read-path',
      label: 'Cache present and wired between the app tier and the datastore',
      max: 3,
      run: (g) => {
        const cache = hasRole(g, 'cache');
        const wired = pathExists(g, 'appServer', 'cache') && pathExists(g, 'cache', 'datastore');
        if (wired) return { points: 3, verdict: 'pass', detail: 'The cache sits on the read path, between the app tier and the datastore.' };
        if (cache) return { points: 1, verdict: 'partial', detail: "A cache is drawn but isn't wired between the app tier and the datastore." };
        return { points: 0, verdict: 'fail', detail: 'No cache on the read path — redirects (the dominant traffic) would hit the datastore every time.' };
      },
    },
    {
      id: 'id-strategy',
      label: 'Short-code generation strategy named',
      max: 2,
      run: (g) =>
        keywordAnywhere(g, ID_STRATEGY_KEYWORDS)
          ? { points: 2, verdict: 'pass', detail: 'A short-code generation strategy is named.' }
          : {
              points: 0,
              verdict: 'fail',
              detail: 'Name how short codes are generated (e.g. a base62-encoded counter, a Snowflake-style ID, or hash + collision check) — this is the actual hard part of this problem.',
            },
    },
    {
      id: 'no-spof',
      label: 'No single point of failure across load balancer / app tier / datastore',
      max: 3,
      run: (g) => {
        const tiers = ['loadBalancer', 'appServer', 'datastore'] as const;
        const shown = tiers.filter((r) => redundancyEvidence(g, r));
        const missing = tiers.filter((r) => !shown.includes(r));
        const verdict = missing.length === 0 ? 'pass' : shown.length === 0 ? 'fail' : 'partial';
        const detail =
          missing.length === 0
            ? 'Every tier shows redundancy evidence.'
            : `No redundancy shown for: ${missing.join(', ')} — a single instance of any of these takes the service down.`;
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
    {
      id: 'shard-key',
      label: 'Sharding key named (multiple datastore nodes drawn)',
      max: 2,
      applicable: (g) => nodesWithRole(g, 'datastore').length >= 2,
      run: (g) =>
        keywordAnywhere(g, SHARD_KEY_KEYWORDS)
          ? { points: 2, verdict: 'pass', detail: 'A sharding key is named.' }
          : { points: 0, verdict: 'fail', detail: 'Multiple datastore nodes are drawn (sharded) but no shard key is named.' },
    },
  ],
};

const STATEMENT = `Design a URL shortener (e.g. bit.ly / TinyURL). Given a long URL, the service returns a short alias; visiting the alias redirects to the original URL.

Functional requirements:
- Shorten a long URL into a short code.
- Redirect a short code to its original URL.
- (Optional) Let a user pick a custom alias.
- (Optional) Expire links after a TTL.

Non-functional requirements / scale:
- 100M new URLs created per month.
- Read:write ratio of roughly 100:1 (reads are redirects).
- Redirects must be low-latency (single-digit ms at the cache).
- Short codes must never collide.
- The system should survive the loss of any single instance.`;

const REFERENCE_APPROACH = `A reasonable reference: a client hits a load balancer, which fans out to a stateless fleet of API servers. Writes (POST /shorten) get an ID from a dedicated ID-generation approach — a counter service backed by a small, replicated key-range allocator, or a Snowflake-style ID, base62-encoded into ~7 characters — and store {code -> longUrl} in a datastore chosen for the access pattern: a simple key-value store or a relational table with an index on \`code\` both work, since lookups are always by primary key. Reads (GET /:code) go through a cache (Redis) in front of the datastore, since the workload is read-heavy; a cache miss falls through to the datastore and populates the cache. Redundancy: at least two instances of the load balancer, the API tier, and the datastore (primary + replica), so no single node loss takes the service down. If the datastore is sharded (rarely necessary at this scale, but worth naming if you do it), shard by a hash of the short code so lookups stay single-shard. The two things interviewers listen for specifically: (1) how you generate unique codes without a central bottleneck, and (2) that you noticed the read-heavy skew and put a cache on the read path rather than hitting the datastore on every redirect.`;

export const URL_SHORTENER: DesignProblem = {
  slug: 'design-a-url-shortener',
  track: 'hld',
  title: 'Design a URL Shortener',
  difficulty: 'Medium',
  statement: STATEMENT,
  rubric: URL_SHORTENER_RUBRIC,
  referenceApproach: REFERENCE_APPROACH,
  hints: [
    'This workload is extremely read-skewed (100:1). What does that imply about where a cache should sit relative to the datastore?',
    'How will you generate a short code that\'s guaranteed unique without a central bottleneck every request has to go through?',
    'Put a cache between the app tier and the datastore on the redirect (read) path, and generate codes via a base62-encoded counter or a Snowflake-style ID — not a hash-and-hope-for-no-collisions scheme.',
  ],
};
