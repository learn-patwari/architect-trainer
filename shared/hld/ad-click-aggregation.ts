import { allNodesLabeled, hasRole, keywordAnywhere, pathExists } from '../rubric/checks.ts';
import type { RubricSpec } from '../rubric/types.ts';
import type { DesignProblem } from '../types.ts';

/**
 * A streaming-analytics/aggregation-pipeline problem: the crux is an
 * event-time windowed aggregation with exactly-once-ish correctness (dedup)
 * and a separate batch path for reconciliation, not the ad-serving path
 * itself (out of scope — this is billing-relevant counting).
 */

const STREAM_PROCESSOR_KEYWORDS = ['flink', 'spark streaming', 'stream processor', 'stream processing'];
const WINDOWING_KEYWORDS = ['window', 'tumbling window', 'sliding window', 'watermark'];
const DEDUP_KEYWORDS = ['dedup', 'idempotent', 'exactly-once', 'click id'];
const LATE_DATA_KEYWORDS = ['late-arriving', 'late arriving', 'out-of-order', 'out of order'];
const BATCH_RECONCILE_KEYWORDS = ['batch job', 'reconcil', 'nightly batch', 'backfill'];
const HOT_AD_KEYWORDS = ['hot ad', 'popular ad', 'skew'];

const AD_CLICK_AGGREGATION_RUBRIC: RubricSpec = {
  id: 'design-ad-click-event-aggregation',
  title: 'Design Ad Click Event Aggregation — rubric',
  checks: [
    {
      id: 'ingestion-queue',
      label: 'Click events are ingested through a queue/log',
      max: 2,
      run: (g) =>
        hasRole(g, 'queue')
          ? { points: 2, verdict: 'pass', detail: 'A queue/log ingests click events.' }
          : { points: 0, verdict: 'fail', detail: 'A click firehose at this volume needs to land in a durable queue/log (Kafka), not be processed inline by the app server that received it.' },
    },
    {
      id: 'stream-processor',
      label: 'A stream processor consumes and aggregates the events',
      max: 3,
      run: (g) =>
        keywordAnywhere(g, STREAM_PROCESSOR_KEYWORDS)
          ? { points: 3, verdict: 'pass', detail: 'A stream processor is named.' }
          : { points: 0, verdict: 'fail', detail: 'Name a stream-processing layer (Flink, Spark Streaming) that consumes the click stream and computes running counts, rather than aggregating ad hoc on every dashboard query.' },
    },
    {
      id: 'windowing-named',
      label: 'Aggregation is windowed by event time',
      max: 3,
      run: (g) =>
        keywordAnywhere(g, WINDOWING_KEYWORDS)
          ? { points: 3, verdict: 'pass', detail: 'Time-windowed aggregation is named.' }
          : { points: 0, verdict: 'fail', detail: 'Name how "clicks per ad per minute" is actually computed — a time window (tumbling or sliding), keyed by the event\'s own timestamp, not when it happened to arrive.' },
    },
    {
      id: 'late-data-handling',
      label: 'Late-arriving events are explicitly handled',
      max: 3,
      run: (g) =>
        keywordAnywhere(g, LATE_DATA_KEYWORDS)
          ? { points: 3, verdict: 'pass', detail: 'Late-data handling is named.' }
          : {
              points: 0,
              verdict: 'fail',
              detail: 'A click from a spotty mobile connection can arrive minutes after it happened — name how a window still accounts for it (a watermark/grace period) instead of silently dropping it.',
            },
    },
    {
      id: 'dedup-named',
      label: 'Duplicate click detection is named',
      max: 3,
      run: (g) =>
        keywordAnywhere(g, DEDUP_KEYWORDS)
          ? { points: 3, verdict: 'pass', detail: 'Deduplication is named.' }
          : {
              points: 0,
              verdict: 'fail',
              detail: 'This count drives ad billing — a retried or duplicated click event must not be counted twice. Name a dedup key (a unique click ID) and idempotent aggregation.',
            },
    },
    {
      id: 'batch-reconciliation',
      label: 'A batch reconciliation path corrects the streaming counts',
      max: 2,
      run: (g) =>
        keywordAnywhere(g, BATCH_RECONCILE_KEYWORDS)
          ? { points: 2, verdict: 'pass', detail: 'Batch reconciliation is named.' }
          : { points: 0, verdict: 'fail', detail: 'Streaming aggregation trades some correctness for speed — name a nightly batch job that recomputes the exact totals from the raw log for billing-grade accuracy.' },
    },
    {
      id: 'hot-ad-handling',
      label: 'Skew from a small number of very popular ads is acknowledged',
      max: 2,
      run: (g) =>
        keywordAnywhere(g, HOT_AD_KEYWORDS)
          ? { points: 2, verdict: 'pass', detail: 'Hot-ad skew is acknowledged.' }
          : { points: 0, verdict: 'fail', detail: 'A viral ad can get a disproportionate share of clicks, hot-spotting its aggregation key — name how that skew is handled (pre-aggregating locally before a global merge).' },
    },
    {
      id: 'lb-in-front',
      label: 'A load balancer fronts the click-ingestion endpoint',
      max: 1,
      run: (g) => (pathExists(g, 'client', 'loadBalancer') ? { points: 1, verdict: 'pass', detail: 'A load balancer is present.' } : { points: 0, verdict: 'fail', detail: 'Front the click-ingestion endpoint with a load balancer.' }),
    },
    {
      id: 'all-labeled',
      label: 'Every node is labeled',
      max: 1,
      run: (g) => {
        const { labeled, total } = allNodesLabeled(g);
        if (total === 0) return { points: 0, verdict: 'fail', detail: 'Nothing drawn yet.' };
        const points = Math.round((1 * labeled) / total);
        const verdict = labeled === total ? 'pass' : labeled === 0 ? 'fail' : 'partial';
        return { points, verdict, detail: labeled === total ? 'Every shape is labeled.' : `${total - labeled} shape(s) have no label.` };
      },
    },
  ],
};

const STATEMENT = `Design a system that aggregates ad click events in near real time — "how many clicks did ad X get in the last minute" — for a live dashboard, feeding into ad billing.

Functional requirements:
- Ingest a high-volume stream of click events (adId, userId, timestamp, ...).
- Produce per-ad click counts aggregated into fixed time windows (e.g. per minute), available with only a few seconds of delay.
- A click must be counted exactly once, even if the client retries the request or the pipeline reprocesses a message.

Non-functional requirements / scale:
- Hundreds of thousands of clicks per second at peak, extremely skewed toward a small number of popular ads.
- Some clicks arrive late (a flaky mobile connection) — a naive window that closes too early would undercount.
- Counts feed directly into advertiser billing, so long-term correctness matters more than the real-time dashboard's precision.`;

const REFERENCE_APPROACH = `Click events are ingested into a durable log (Kafka), decoupling the high-volume write path from how fast downstream aggregation can keep up. A stream processor (Flink is the canonical real-world choice here) consumes the log and maintains running per-ad counts inside time windows keyed by the event's own timestamp (event time), not by when it happened to arrive (processing time) — this distinction matters because a click delayed by a bad mobile connection should still count toward the minute it actually happened in. Late-arriving events are handled with a watermark: the window stays open for a bounded grace period past its nominal end time specifically to absorb reasonably-late data, after which it closes and emits a result; data arriving after that is either dropped or corrected by the batch path. Because this feeds billing, exactly-once counting matters: each click carries a unique ID, and the aggregation logic dedupes on it (an idempotent update, or tracking seen-click-IDs within the relevant window) so a retried or replayed event isn't double-counted. A small number of viral ads can dominate traffic, hot-spotting their aggregation key on one stream-processing task — this is mitigated with a local pre-aggregation step (combine counts for a hot key within each processing node first, then merge the partial sums globally) rather than routing every single click for that ad through one task. Because streaming aggregation trades some precision for speed (approximate windowing, best-effort late-data handling), a separate nightly batch job re-reads the full raw click log and recomputes exact totals, which is what advertiser billing actually reconciles against — the real-time numbers are for the live dashboard, not the invoice.`;

export const AD_CLICK_AGGREGATION: DesignProblem = {
  slug: 'design-ad-click-event-aggregation',
  track: 'hld',
  title: 'Design Ad Click Event Aggregation',
  difficulty: 'Hard',
  statement: STATEMENT,
  rubric: AD_CLICK_AGGREGATION_RUBRIC,
  referenceApproach: REFERENCE_APPROACH,
  hints: [
    'A click happened at 12:00:58 but arrives at the server at 12:01:03, after the "12:00" window already closed. Which minute should it count toward, and how does the window stay open long enough to catch it?',
    'This count feeds billing. If the same click event gets processed twice (a retry, a replay), what stops it from being counted twice?',
    'Aggregate in a stream processor windowed by event time with a watermark for late data, dedupe by a unique click ID for exactly-once counting, and reconcile with a nightly batch job over the raw log for billing-grade accuracy.',
  ],
};
