import { allNodesLabeled, hasRole, keywordAnywhere, normalize, pathExists, redundancyEvidence } from '../rubric/checks.ts';
import type { RubricSpec } from '../rubric/types.ts';
import type { DesignProblem } from '../types.ts';

/**
 * An Easy-tier HLD problem, deliberately close in shape to the URL shortener — it's
 * one of the most commonly recommended first system design problems for a reason:
 * the same LB/app/datastore/ID-strategy skeleton, but with one added wrinkle (paste
 * bodies are big and variable-sized, so they don't belong inline in a relational row).
 */

const SPECIFIC_DATASTORE_KEYWORDS = ['postgres', 'mysql', 'dynamodb', 'cassandra', 'mongodb', 'cockroachdb', 'key-value', 'kv store'];
const BLOB_STORAGE_KEYWORDS = ['s3', 'object storage', 'blob storage', 'cloud storage', 'blob store'];
const ID_STRATEGY_KEYWORDS = ['base62', 'base-62', 'base 62', 'counter', 'snowflake', 'uuid', 'hash', 'random string'];
const EXPIRY_KEYWORDS = ['ttl', 'expire', 'expiry', 'expiration', 'auto-delete'];

const PASTEBIN_RUBRIC: RubricSpec = {
  id: 'design-a-pastebin',
  title: 'Design a Pastebin — rubric',
  checks: [
    {
      id: 'load-balancer',
      label: 'Load balancer in front of the app tier',
      max: 3,
      run: (g) => {
        if (pathExists(g, 'loadBalancer', 'appServer')) return { points: 3, verdict: 'pass', detail: 'A load balancer sits in front of the app tier.' };
        if (hasRole(g, 'loadBalancer')) return { points: 1, verdict: 'partial', detail: 'A load balancer is drawn but has no path into the app tier — connect it.' };
        return { points: 0, verdict: 'fail', detail: 'No load balancer in front of the app tier.' };
      },
    },
    {
      id: 'app-tier',
      label: 'Application / API tier present',
      max: 2,
      run: (g) => (hasRole(g, 'appServer') ? { points: 2, verdict: 'pass', detail: 'An app/API tier is present.' } : { points: 0, verdict: 'fail', detail: 'No app/API server tier drawn.' }),
    },
    {
      id: 'metadata-datastore-named',
      label: 'A metadata datastore is present and a specific technology named',
      max: 3,
      run: (g) => {
        const stores = g.nodes.filter((n) => n.roles.includes('datastore'));
        if (stores.length === 0) return { points: 0, verdict: 'fail', detail: 'No datastore drawn for paste metadata (id, owner, created-at, expiry).' };
        const specific = stores.some((n) => SPECIFIC_DATASTORE_KEYWORDS.some((k) => normalize(n.label).includes(k)));
        return specific
          ? { points: 3, verdict: 'pass', detail: 'A specific metadata datastore technology is named.' }
          : { points: 1, verdict: 'partial', detail: 'A datastore is drawn but only labeled "database"/"DB" — name the actual technology.' };
      },
    },
    {
      id: 'blob-storage-named',
      label: 'Large paste bodies are stored in object/blob storage, not inline in a row',
      max: 3,
      run: (g) =>
        keywordAnywhere(g, BLOB_STORAGE_KEYWORDS)
          ? { points: 3, verdict: 'pass', detail: 'Paste content is stored in object/blob storage, separate from metadata.' }
          : {
              points: 0,
              verdict: 'fail',
              detail: 'A paste can be arbitrarily large — name where the actual text body lives (e.g. S3/blob storage), separate from the metadata row that points at it.',
            },
    },
    {
      id: 'id-strategy',
      label: 'A short-ID generation strategy is named',
      max: 2,
      run: (g) =>
        keywordAnywhere(g, ID_STRATEGY_KEYWORDS)
          ? { points: 2, verdict: 'pass', detail: 'An ID generation strategy is named.' }
          : { points: 0, verdict: 'fail', detail: 'Name how each paste gets its short, unique ID (e.g. a base62-encoded counter or a hash of the content).' },
    },
    {
      id: 'expiry-named',
      label: 'Paste expiry / TTL is addressed',
      max: 2,
      run: (g) =>
        keywordAnywhere(g, EXPIRY_KEYWORDS)
          ? { points: 2, verdict: 'pass', detail: 'Paste expiry is addressed.' }
          : { points: 0, verdict: 'fail', detail: 'Pastes commonly support a "burn after reading" or TTL option — say how an expired paste actually gets removed (lazy check on read vs. a background sweep).' },
    },
    {
      id: 'no-spof',
      label: 'No single point of failure across load balancer / app tier / metadata datastore',
      max: 3,
      run: (g) => {
        const tiers = ['loadBalancer', 'appServer', 'datastore'] as const;
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

const STATEMENT = `Design a pastebin (e.g. pastebin.com). A user pastes a block of text and gets back a short, shareable link; visiting the link shows the original text.

Functional requirements:
- Create a paste and get back a short URL for it.
- View a paste by its short URL.
- (Optional) Let a paste expire after a chosen TTL, or after being read once ("burn after reading").
- (Optional) Support syntax highlighting by language — doesn't affect the storage design.

Non-functional requirements / scale:
- 1M new pastes per day; reads outnumber writes roughly 10:1.
- A paste can range from a few bytes to several megabytes of text.
- The system should survive the loss of any single instance.`;

const REFERENCE_APPROACH = `Structurally this is the same skeleton as a URL shortener: a load balancer fans out to a stateless app tier. The one design decision that actually distinguishes a pastebin is size variance — a paste can be a few bytes or several megabytes, so it shouldn't live inline in a relational row the way a URL does. Store the paste body in object storage (S3 or equivalent), keyed by the same short ID, and keep a small metadata row (id, owner, created-at, size, expiry) in a regular datastore for fast lookups and listing. The short ID itself can be generated the same way as a URL shortener's code (a base62-encoded counter, or a hash of the content for automatic dedup of identical pastes). Expiry is worth naming explicitly: either a TTL index in the metadata store that lazily invalidates on read, or a background sweep that deletes both the metadata row and the blob once expired — "burn after reading" is just a special case where the TTL is "the first successful read." Redundancy: multiple instances of the load balancer and app tier, plus a replicated metadata store; object storage is redundant by default in any managed offering, so it usually doesn't need its own redundancy discussion.`;

export const PASTEBIN: DesignProblem = {
  slug: 'design-a-pastebin',
  track: 'hld',
  title: 'Design a Pastebin',
  difficulty: 'Easy',
  statement: STATEMENT,
  rubric: PASTEBIN_RUBRIC,
  referenceApproach: REFERENCE_APPROACH,
  hints: [
    'This is structurally almost identical to a URL shortener — the interesting question is what\'s different about what you\'re storing.',
    'A paste can be a few bytes or several megabytes. Where should the actual text body live, separate from the small metadata row that points at it?',
    'Store the paste content in object/blob storage (S3-style), keyed by the same short ID; keep only metadata (id, owner, size, expiry) in your regular datastore, and name a TTL or sweep job for expiry.',
  ],
};
