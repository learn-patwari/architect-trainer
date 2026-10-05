import { allNodesLabeled, hasRole, keywordAnywhere, pathExists, redundancyEvidence } from '../rubric/checks.ts';
import type { RubricSpec } from '../rubric/types.ts';
import type { DesignProblem } from '../types.ts';

/**
 * The second HLD problem: a fan-out-heavy read path, unlike the URL shortener's
 * simple cache-in-front-of-a-datastore shape. Reuses every primitive from
 * shared/rubric/checks.ts untouched.
 */

const FANOUT_KEYWORDS = ['fan-out', 'fanout', 'fan out', 'push model', 'pull model', 'hybrid fan'];

const NEWS_FEED_RUBRIC: RubricSpec = {
  id: 'design-a-news-feed',
  title: 'Design a News Feed — rubric',
  checks: [
    {
      id: 'load-balancer',
      label: 'Load balancer in front of the app tier',
      max: 3,
      run: (g) =>
        pathExists(g, 'loadBalancer', 'appServer')
          ? { points: 3, verdict: 'pass', detail: 'A load balancer sits in front of the app tier.' }
          : hasRole(g, 'loadBalancer')
            ? { points: 1, verdict: 'partial', detail: 'A load balancer is drawn but has no path into the app tier.' }
            : { points: 0, verdict: 'fail', detail: 'No load balancer in front of the app tier.' },
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
      id: 'post-datastore',
      label: 'A datastore for posts is present',
      max: 2,
      run: (g) =>
        hasRole(g, 'datastore')
          ? { points: 2, verdict: 'pass', detail: 'A datastore for posts is present.' }
          : { points: 0, verdict: 'fail', detail: 'No datastore drawn to durably store posts.' },
    },
    {
      id: 'queue-decouples-fanout',
      label: 'A queue decouples fan-out work from the post write path',
      max: 3,
      run: (g) => {
        const wired = pathExists(g, 'appServer', 'queue');
        if (wired) return { points: 3, verdict: 'pass', detail: 'The write path publishes to a queue rather than fanning out synchronously.' };
        if (hasRole(g, 'queue')) return { points: 1, verdict: 'partial', detail: 'A queue is drawn but not wired to the post write path.' };
        return { points: 0, verdict: 'fail', detail: 'No queue — fanning out to every follower synchronously on the write path would make posting slow for anyone with many followers.' };
      },
    },
    {
      id: 'feed-cache',
      label: 'A cache holds the precomputed (or hot-path) feed',
      max: 3,
      run: (g) => {
        const wired = pathExists(g, 'queue', 'cache') || pathExists(g, 'appServer', 'cache');
        if (wired) return { points: 3, verdict: 'pass', detail: 'A cache sits on the feed read path.' };
        if (hasRole(g, 'cache')) return { points: 1, verdict: 'partial', detail: "A cache is drawn but isn't wired into the feed read or fan-out path." };
        return { points: 0, verdict: 'fail', detail: 'No cache — reading a home timeline by querying posts from 200 followed users on every request would be far too slow.' };
      },
    },
    {
      id: 'fanout-strategy',
      label: 'Fan-out strategy named (push / pull / hybrid for celebrities)',
      max: 2,
      run: (g) =>
        keywordAnywhere(g, FANOUT_KEYWORDS)
          ? { points: 2, verdict: 'pass', detail: 'A fan-out strategy is named.' }
          : {
              points: 0,
              verdict: 'fail',
              detail: 'Name the fan-out strategy (push/fan-out-on-write for most users, pull/fan-out-on-read or a hybrid for celebrity accounts) — this is the actual hard part of this problem.',
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
          missing.length === 0 ? 'Every tier shows redundancy evidence.' : `No redundancy shown for: ${missing.join(', ')}.`;
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

const STATEMENT = `Design a simplified news feed (Twitter/X-style). Users post short text updates; followers see posts from people they follow in a home timeline, most recent first.

Functional requirements:
- Post a short update.
- Follow / unfollow another user.
- View a home timeline of posts from people you follow.

Non-functional requirements / scale:
- 200M registered users, 100M daily active.
- An average user follows ~200 people; a celebrity account may have 50M followers.
- Read:write ratio roughly 1000:1 (far more feed reads than posts).
- Feed reads should be fast (well under 200ms).
- A few seconds of delay before a post reaches every follower's feed is acceptable.`;

const REFERENCE_APPROACH = `Writes go through a load balancer to a stateless app tier, which persists the post to a write-optimized datastore (e.g. Cassandra, given the write volume and simple by-user access pattern) and publishes a "new post" event to a queue (Kafka) rather than fanning out synchronously. A pool of fan-out workers consumes that queue and, for push/fan-out-on-write, appends the post into each follower's precomputed feed — a Redis sorted set keyed by user, scored by time — so a feed read is a single fast cache lookup. Celebrity accounts break this: fanning a single post out to 50M followers synchronously (or even asynchronously, at that volume) is prohibitively expensive, so those are handled with fan-out-on-read (or a hybrid): a user's feed read merges their precomputed feed with a live, on-demand fetch of posts from the small number of celebrities they follow. Redundancy: multiple load balancer, app-tier, and datastore instances so no single node loss takes the write or read path down. The two things interviewers listen for specifically: (1) that fan-out happens off the write path via a queue rather than blocking the post request, and (2) that the design has an explicit answer for the celebrity/hot-key case rather than pure push fan-out for everyone.`;

export const NEWS_FEED: DesignProblem = {
  slug: 'design-a-news-feed',
  track: 'hld',
  title: 'Design a News Feed',
  difficulty: 'Hard',
  statement: STATEMENT,
  rubric: NEWS_FEED_RUBRIC,
  referenceApproach: REFERENCE_APPROACH,
  hints: [
    'A post has to reach every follower\'s feed. Does that have to happen synchronously, on the same request that creates the post?',
    'What breaks about your fan-out approach the moment one account has 50 million followers?',
    'Fan posts out asynchronously via a queue into a precomputed per-user feed cache for most users, but fall back to fan-out-on-read (merging in celebrity posts live at read time) for accounts with huge follower counts.',
  ],
};
