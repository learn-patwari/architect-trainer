import { allNodesLabeled, hasRole, keywordAnywhere, pathExists } from '../rubric/checks.ts';
import type { RubricSpec } from '../rubric/types.ts';
import type { DesignProblem } from '../types.ts';

/**
 * A metrics-and-alerting pipeline: the crux is a time-series-shaped
 * datastore (not a general-purpose relational one), downsampling old data,
 * and an alerting layer decoupled from ingestion so a slow alert evaluator
 * can't back-pressure the write path.
 */

const PUSH_PULL_KEYWORDS = ['push model', 'pull model', 'scrape'];
const TSDB_KEYWORDS = ['time-series database', 'time series database', 'tsdb', 'prometheus', 'influxdb'];
const DOWNSAMPLING_KEYWORDS = ['downsampl', 'rollup', 'roll-up', 'retention policy'];
const ALERTING_KEYWORDS = ['alert', 'alerting rule', 'threshold'];
const DEDUP_KEYWORDS = ['dedup', 'debounce', 'flapping'];
const AGGREGATION_KEYWORDS = ['aggregat', 'pre-aggregat'];

const METRICS_MONITORING_RUBRIC: RubricSpec = {
  id: 'design-a-metrics-monitoring-system',
  title: 'Design a Metrics Monitoring and Alerting System — rubric',
  checks: [
    {
      id: 'collection-model',
      label: 'A collection model (push or pull) is named',
      max: 3,
      run: (g) =>
        keywordAnywhere(g, PUSH_PULL_KEYWORDS)
          ? { points: 3, verdict: 'pass', detail: 'A push/pull collection model is named.' }
          : { points: 0, verdict: 'fail', detail: 'Name how metrics actually get from a host to the system — services push metrics out, or a central collector pulls (scrapes) them on an interval.' },
    },
    {
      id: 'queue-buffer',
      label: 'Ingested metrics are buffered through a queue before storage',
      max: 2,
      run: (g) =>
        hasRole(g, 'queue')
          ? { points: 2, verdict: 'pass', detail: 'A queue buffers ingestion.' }
          : { points: 0, verdict: 'fail', detail: 'A write spike shouldn\'t hit the time-series store directly — buffer ingested metrics through a queue to smooth bursts.' },
    },
    {
      id: 'tsdb-named',
      label: 'A time-series-optimized datastore is named',
      max: 3,
      run: (g) =>
        keywordAnywhere(g, TSDB_KEYWORDS)
          ? { points: 3, verdict: 'pass', detail: 'A time-series datastore is named.' }
          : { points: 0, verdict: 'fail', detail: 'A general relational database is a poor fit for extremely high write volume, append-mostly, time-ordered data — name a time-series-optimized store (Prometheus, InfluxDB).' },
    },
    {
      id: 'downsampling-named',
      label: 'Downsampling/retention for old data is named',
      max: 3,
      run: (g) =>
        keywordAnywhere(g, DOWNSAMPLING_KEYWORDS)
          ? { points: 3, verdict: 'pass', detail: 'Downsampling/retention is named.' }
          : {
              points: 0,
              verdict: 'fail',
              detail: 'Storing every raw data point forever doesn\'t scale — name downsampling old data into coarser rollups (per-minute -> per-hour -> per-day) as it ages, with a retention policy.',
            },
    },
    {
      id: 'alerting-decoupled',
      label: 'Alert evaluation is a separate component from ingestion',
      max: 3,
      run: (g) =>
        keywordAnywhere(g, ALERTING_KEYWORDS)
          ? { points: 3, verdict: 'pass', detail: 'A separate alerting component is named.' }
          : {
              points: 0,
              verdict: 'fail',
              detail: 'Alert-rule evaluation shouldn\'t run inline with ingestion — a slow or buggy alert evaluator could then back-pressure the write path. Name it as its own component reading from storage.',
            },
    },
    {
      id: 'alert-dedup',
      label: 'Alert deduplication/flap-suppression is named',
      max: 2,
      run: (g) =>
        keywordAnywhere(g, DEDUP_KEYWORDS)
          ? { points: 2, verdict: 'pass', detail: 'Alert deduplication is named.' }
          : { points: 0, verdict: 'fail', detail: 'A metric oscillating around a threshold shouldn\'t page someone every few seconds — name deduplication or a debounce window before firing a repeat alert.' },
    },
    {
      id: 'query-aggregation',
      label: 'Dashboard queries aggregate rather than reading raw points',
      max: 2,
      run: (g) =>
        keywordAnywhere(g, AGGREGATION_KEYWORDS)
          ? { points: 2, verdict: 'pass', detail: 'Query-time aggregation is named.' }
          : { points: 0, verdict: 'fail', detail: 'A dashboard showing a week of data shouldn\'t pull every raw point — name aggregation (querying pre-rolled-up data, or aggregating on read).' },
    },
    {
      id: 'lb-in-front',
      label: 'A load balancer fronts the collection/query tier',
      max: 1,
      run: (g) => (pathExists(g, 'client', 'loadBalancer') ? { points: 1, verdict: 'pass', detail: 'A load balancer is present.' } : { points: 0, verdict: 'fail', detail: 'Front the collection/query tier with a load balancer.' }),
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

const STATEMENT = `Design a metrics monitoring and alerting system (like Prometheus + Alertmanager, or Datadog): services emit numeric time-series metrics continuously, and the system stores them, powers dashboards, and pages someone when a metric crosses a threshold.

Functional requirements:
- Collect a numeric metric (e.g. request rate, CPU usage) per service instance, on a regular interval.
- Query historical data for a dashboard, at varying time ranges (last hour to last year).
- Evaluate alerting rules continuously and notify on-call when a threshold is breached — without paging repeatedly for the same ongoing issue.

Non-functional requirements / scale:
- Millions of individual time series, each receiving a new data point every 10-60 seconds.
- Old data can be less precise (a rollup) without breaking dashboards that show a long time range.
- Alert evaluation must not be slowed down or broken by ingestion load, or vice versa.`;

const REFERENCE_APPROACH = `Metrics are collected either by a push model (each service pushes its metrics to a collector) or a pull model (a central collector scrapes each service's metrics endpoint on an interval) — Prometheus's own real-world design is pull-based specifically because it keeps collection logic centralized and makes it trivial to tell a target is down (a failed scrape). Ingested metrics are buffered through a queue before hitting storage, so a burst (many services reporting at once) doesn't overwhelm the write path. They land in a time-series-optimized datastore (Prometheus's own TSDB, or InfluxDB) rather than a general relational database, since these stores are built around the actual shape of the workload: append-mostly, time-ordered, extremely high write volume, with compression schemes (like delta-of-delta timestamp encoding) tuned for that pattern. As data ages, it's downsampled into coarser rollups under a retention policy (raw 15-second data kept for a week, per-minute rollups for a month, per-hour rollups for a year) so long-range dashboard queries stay fast and storage doesn't grow unbounded. Alert-rule evaluation runs as its own component (reading from the store on its own schedule), deliberately decoupled from ingestion, so a slow rule evaluator can't back-pressure metric writes and vice versa. To avoid paging on every noisy blip, alerts are deduplicated/debounced — a rule typically has to stay breached for a sustained window (e.g. 5 minutes) before firing, and repeat firings for the same ongoing incident are grouped rather than re-alerting on every evaluation cycle.`;

export const METRICS_MONITORING_SYSTEM: DesignProblem = {
  slug: 'design-a-metrics-monitoring-system',
  track: 'hld',
  title: 'Design a Metrics Monitoring and Alerting System',
  difficulty: 'Medium',
  statement: STATEMENT,
  rubric: METRICS_MONITORING_RUBRIC,
  referenceApproach: REFERENCE_APPROACH,
  hints: [
    'Millions of time series, each getting a new point every 10-60 seconds, forever. What happens to storage if every raw point is kept at full precision indefinitely?',
    'If a slow bug in alert-rule evaluation ran inline with metric ingestion, what would break? What does that suggest about where alerting should live?',
    'Collect via push or pull into a queue, store in a time-series-optimized datastore with downsampling/retention as data ages, and run alert evaluation as its own decoupled component with debouncing to avoid re-paging on the same issue.',
  ],
};
