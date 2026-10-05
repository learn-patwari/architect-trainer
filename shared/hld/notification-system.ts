import { allNodesLabeled, hasRole, keywordAnywhere, pathExists, redundancyEvidence } from '../rubric/checks.ts';
import type { RubricSpec } from '../rubric/types.ts';
import type { DesignProblem } from '../types.ts';

/**
 * A fan-out-to-heterogeneous-providers problem: the crux is isolating each
 * delivery channel from the others' failures, plus dedup, since the queue's
 * at-least-once delivery means a worker will sometimes see the same request twice.
 */

const DEDUP_KEYWORDS = ['idempotency', 'idempotent', 'dedup', 'dedupe'];
const TEMPLATE_KEYWORDS = ['template', 'preference', 'opt-out', 'do not disturb', 'do-not-disturb'];
const CHANNELS = ['push notification', 'email', 'sms'];

const NOTIFICATION_RUBRIC: RubricSpec = {
  id: 'design-a-notification-system',
  title: 'Design a Notification System — rubric',
  checks: [
    {
      id: 'app-tier',
      label: 'An ingestion/notification service tier is present',
      max: 2,
      run: (g) => (hasRole(g, 'appServer') ? { points: 2, verdict: 'pass', detail: 'An ingestion/notification service is present.' } : { points: 0, verdict: 'fail', detail: 'No ingestion/notification service tier drawn.' }),
    },
    {
      id: 'queue-decouples-delivery',
      label: 'A queue decouples ingestion from actually calling any provider',
      max: 3,
      run: (g) => {
        const wired = pathExists(g, 'appServer', 'queue');
        if (wired) return { points: 3, verdict: 'pass', detail: 'Notification requests are queued rather than delivered synchronously.' };
        if (hasRole(g, 'queue')) return { points: 1, verdict: 'partial', detail: 'A queue is drawn but not wired to the ingestion tier.' };
        return { points: 0, verdict: 'fail', detail: 'No queue — calling push/email/SMS providers synchronously on the request path means a slow provider blocks the caller.' };
      },
    },
    {
      id: 'multi-channel',
      label: 'At least two delivery channels (push/email/SMS) are named',
      max: 3,
      run: (g) => {
        const hits = CHANNELS.filter((c) => keywordAnywhere(g, [c]));
        if (hits.length >= 2) return { points: 3, verdict: 'pass', detail: `${hits.length} delivery channels are named.` };
        if (hits.length === 1) return { points: 1, verdict: 'partial', detail: 'Only one delivery channel is named — the prompt asks for multiple.' };
        return { points: 0, verdict: 'fail', detail: 'Name at least two delivery channels (push notification, email, SMS).' };
      },
    },
    {
      id: 'dedup-idempotency',
      label: 'Deduplication / idempotency on delivery is named',
      max: 3,
      run: (g) =>
        keywordAnywhere(g, DEDUP_KEYWORDS)
          ? { points: 3, verdict: 'pass', detail: 'A dedup/idempotency mechanism is named.' }
          : {
              points: 0,
              verdict: 'fail',
              detail: 'A queue delivers at-least-once, so a worker will sometimes see the same request twice — name what stops that from becoming two sends to the user (an idempotency check keyed by notification ID).',
            },
    },
    {
      id: 'template-or-preference',
      label: 'Templates and/or per-user preferences are named',
      max: 2,
      run: (g) =>
        keywordAnywhere(g, TEMPLATE_KEYWORDS)
          ? { points: 2, verdict: 'pass', detail: 'Templates or preferences are named.' }
          : { points: 0, verdict: 'fail', detail: 'Say how a notification is actually rendered (a template with per-notification data) and how a user\'s channel preferences are respected.' },
    },
    {
      id: 'datastore-present',
      label: 'A datastore for delivery status/history is present',
      max: 2,
      run: (g) => (hasRole(g, 'datastore') ? { points: 2, verdict: 'pass', detail: 'A datastore is present.' } : { points: 0, verdict: 'fail', detail: 'No datastore drawn for delivery status/history.' }),
    },
    {
      id: 'no-spof',
      label: 'No single point of failure across the ingestion tier / queue / datastore',
      max: 3,
      run: (g) => {
        const tiers = ['appServer', 'queue', 'datastore'] as const;
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

const STATEMENT = `Design a notification system that sends a message to a user across multiple channels (push, email, SMS) when a triggering event happens elsewhere in the product, without ever sending the same notification twice.

Functional requirements:
- Accept a notification request from any internal service and deliver it via push, email, and/or SMS depending on the user's preferences.
- Never deliver the same logical notification twice, even if the request is retried.
- Render each notification from a template with per-notification data.

Non-functional requirements / scale:
- Hundreds of millions of notifications per day, bursty around specific events.
- A slow or failing third-party provider (e.g. an SMS gateway outage) for one channel must not block or slow delivery on the other channels.
- Delivery status should be trackable per notification.`;

const REFERENCE_APPROACH = `A producer (any internal service) posts a notification request to an ingestion API, which validates it, assigns it a unique ID, and drops it onto a durable queue — returning immediately rather than calling any provider synchronously. A pool of notification workers consumes that queue, resolves the user's channel preferences and renders the message from a template, then fans out one message per enabled channel onto that channel's own dedicated queue — so push, email, and SMS are fully isolated from each other: an SMS-provider outage backs up only the SMS queue while push and email keep flowing. Each channel has its own worker pool calling its own provider (APNs/FCM, an email API, an SMS gateway). Deduplication uses the notification's own ID: before sending, a worker checks a short-TTL dedup store (Redis SETNX) for that ID, so a retried request (or a message redelivered at-least-once by the queue) results in exactly one send, not two. Delivery status per notification and channel persists to a datastore for tracking. Redundancy across the ingestion tier, queues, and datastore. The two things interviewers listen for: (1) per-channel isolation via separate queues, so one provider's outage doesn't back up the others, and (2) an explicit idempotency/dedup mechanism, since the queue's at-least-once delivery guarantees a worker will sometimes see the same message twice.`;

export const NOTIFICATION_SYSTEM: DesignProblem = {
  slug: 'design-a-notification-system',
  track: 'hld',
  title: 'Design a Notification System',
  difficulty: 'Medium',
  statement: STATEMENT,
  rubric: NOTIFICATION_RUBRIC,
  referenceApproach: REFERENCE_APPROACH,
  hints: [
    'If an internal service calls three provider APIs synchronously before responding, what happens the moment one of those providers gets slow?',
    'Your queue delivers at-least-once. What stops the same notification from being sent to the same user twice when a worker sees the same message a second time?',
    'Give each channel (push/email/SMS) its own queue and worker pool so they\'re isolated from each other\'s outages, and dedupe on the notification\'s own ID with a short-TTL store before actually sending.',
  ],
};
