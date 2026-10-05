import { allNodesLabeled, hasRole, keywordAnywhere, pathExists, redundancyEvidence } from '../rubric/checks.ts';
import type { RubricSpec } from '../rubric/types.ts';
import type { DesignProblem } from '../types.ts';

/**
 * A different topology than the request/response problems: a worker/batch
 * pipeline (frontier queue -> fetchers -> parser -> dedup -> back to frontier)
 * rather than clients hitting a load balancer. Still reuses every primitive —
 * just applied to queue/appServer/datastore roles in a different shape.
 */

const DEDUP_KEYWORDS = ['bloom filter', 'seen url', 'dedup', 'hash set of urls'];
const POLITENESS_KEYWORDS = ['per-domain rate limit', 'politeness', 'crawl delay', 'robots.txt'];
const PARSER_KEYWORDS = ['parser', 'extract links', 'html parser'];

const WEB_CRAWLER_RUBRIC: RubricSpec = {
  id: 'design-a-web-crawler',
  title: 'Design a Web Crawler — rubric',
  checks: [
    {
      id: 'frontier-wired',
      label: 'A frontier queue feeds a worker/fetcher tier',
      max: 3,
      run: (g) => {
        const wired = pathExists(g, 'queue', 'appServer');
        if (wired) return { points: 3, verdict: 'pass', detail: 'A frontier queue feeds the fetcher workers.' };
        if (hasRole(g, 'queue')) return { points: 1, verdict: 'partial', detail: 'A queue is drawn but not wired to a worker tier.' };
        return { points: 0, verdict: 'fail', detail: 'No frontier queue — without one decoupling URL discovery from fetching, the crawler has no way to distribute or resume work.' };
      },
    },
    {
      id: 'worker-tier',
      label: 'A fetcher/worker tier is present',
      max: 2,
      run: (g) =>
        hasRole(g, 'appServer')
          ? { points: 2, verdict: 'pass', detail: 'A fetcher/worker tier is present.' }
          : { points: 0, verdict: 'fail', detail: 'No fetcher/worker tier drawn.' },
    },
    {
      id: 'parser-named',
      label: 'A link-extraction/parsing stage is named',
      max: 2,
      run: (g) =>
        keywordAnywhere(g, PARSER_KEYWORDS)
          ? { points: 2, verdict: 'pass', detail: 'A parsing/link-extraction stage is named.' }
          : { points: 0, verdict: 'fail', detail: 'Name the stage that extracts outbound links and content from a fetched page.' },
    },
    {
      id: 'dedup-mechanism',
      label: 'A URL-dedup mechanism that scales to billions of URLs is named',
      max: 3,
      run: (g) =>
        keywordAnywhere(g, DEDUP_KEYWORDS)
          ? { points: 3, verdict: 'pass', detail: 'A dedup mechanism is named.' }
          : {
              points: 0,
              verdict: 'fail',
              detail: 'Name how already-crawled URLs are recognized (a Bloom filter, a distributed seen-URL store) — a plain in-memory HashSet doesn\'t hold billions of URLs.',
            },
    },
    {
      id: 'politeness-named',
      label: 'Per-domain politeness / rate limiting is named',
      max: 3,
      run: (g) =>
        keywordAnywhere(g, POLITENESS_KEYWORDS)
          ? { points: 3, verdict: 'pass', detail: 'Per-domain politeness is named.' }
          : {
              points: 0,
              verdict: 'fail',
              detail: 'Say how the crawler avoids hammering any single site (a per-domain rate limit, honoring robots.txt crawl-delay) — without this, a fast distributed crawler is functionally a DoS tool.',
            },
    },
    {
      id: 'datastore-for-content',
      label: 'A datastore for crawled content/metadata is present',
      max: 2,
      run: (g) =>
        hasRole(g, 'datastore')
          ? { points: 2, verdict: 'pass', detail: 'A datastore for crawled content is present.' }
          : { points: 0, verdict: 'fail', detail: 'No datastore drawn for crawled pages or crawl metadata.' },
    },
    {
      id: 'no-spof',
      label: 'No single point of failure across the frontier queue / worker tier / datastore',
      max: 3,
      run: (g) => {
        const tiers = ['queue', 'appServer', 'datastore'] as const;
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

const STATEMENT = `Design a web crawler that starts from a set of seed URLs, downloads pages, extracts links, and crawls the web at scale — without crawling the same URL twice and without overloading any single website.

Functional requirements:
- Starting from seed URLs, discover and fetch pages, extracting new URLs to crawl.
- Never crawl the same URL twice.
- Store the crawled content and enough metadata to reconstruct the crawl graph.

Non-functional requirements / scale:
- Crawl billions of pages.
- Be "polite" — never overwhelm any single website with concurrent requests.
- Be resumable after a crash, without losing track of what's already been crawled.`;

const REFERENCE_APPROACH = `Seed URLs are pushed onto a frontier queue, which decouples URL discovery from fetching and gives the crawler a natural resume point after a crash. A fleet of fetcher/worker processes pop URLs from the frontier, download the page, and hand it to a parsing stage that extracts both the content to store and any outbound links. Before a newly-discovered link is re-added to the frontier, it's checked against a dedup mechanism sized for billions of URLs — a Bloom filter (accepting a small false-positive rate in exchange for constant memory) or a distributed seen-URL store — since a plain in-memory HashSet can't hold that many entries. Politeness is enforced per domain: a rate limiter (or honoring robots.txt's crawl-delay) caps how many concurrent requests hit any one site, so the crawler doesn't accidentally act as a denial-of-service tool against a small website. Crawled content and metadata persist in a datastore — object storage for raw page content, a database for the crawl graph and URL status. Redundancy across the frontier queue, worker fleet, and datastore. The two things interviewers listen for: (1) a dedup mechanism that genuinely scales, and (2) per-domain politeness, since "crawl fast" without it is the whole problem with a naive crawler.`;

export const WEB_CRAWLER: DesignProblem = {
  slug: 'design-a-web-crawler',
  track: 'hld',
  title: 'Design a Web Crawler',
  difficulty: 'Medium',
  statement: STATEMENT,
  rubric: WEB_CRAWLER_RUBRIC,
  referenceApproach: REFERENCE_APPROACH,
  hints: [
    'You\'ll discover far more URLs than you can fetch right away. What decouples "found a URL" from "fetched a URL"?',
    'At billions of URLs, can an in-memory HashSet realistically tell you what\'s already been crawled?',
    'Use a frontier queue feeding a worker fleet, a Bloom filter (or a distributed seen-URL store) for dedup at that scale, and a per-domain rate limit so you never hammer one site.',
  ],
};
