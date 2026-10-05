import { allNodesLabeled, hasRole, keywordAnywhere, pathExists, redundancyEvidence } from '../rubric/checks.ts';
import type { RubricSpec } from '../rubric/types.ts';
import type { DesignProblem } from '../types.ts';

/**
 * A topology problem rather than a component-selection one: the interesting
 * decisions are global routing and the cross-region replication trade-off, on
 * top of the same "one region's worth" of infra checks the other problems use.
 */

const ROUTING_KEYWORDS = ['geodns', 'latency-based routing', 'anycast', 'global load balancer', 'route 53', 'global accelerator'];
const REPLICATION_KEYWORDS = ['cross-region replication', 'multi-leader', 'active-active', 'active-passive'];
const FAILOVER_KEYWORDS = ['failover', 'rpo', 'rto', 'disaster recovery'];

const MULTI_REGION_RUBRIC: RubricSpec = {
  id: 'design-a-multi-region-deployment',
  title: 'Design a Multi-Region Deployment — rubric',
  checks: [
    {
      id: 'global-routing',
      label: 'Global, latency-aware routing to the nearest healthy region is named',
      max: 3,
      run: (g) =>
        keywordAnywhere(g, ROUTING_KEYWORDS)
          ? { points: 3, verdict: 'pass', detail: 'Global routing to the nearest region is named.' }
          : { points: 0, verdict: 'fail', detail: 'Name how a user is routed to their nearest healthy region (latency-based DNS, anycast, a global load balancer) — without this, "multi-region" is just multiple copies nobody reaches efficiently.' },
    },
    {
      id: 'regional-load-balancer',
      label: 'Each region has a load balancer in front of its app tier',
      max: 3,
      run: (g) =>
        pathExists(g, 'loadBalancer', 'appServer')
          ? { points: 3, verdict: 'pass', detail: 'A load balancer sits in front of the app tier.' }
          : hasRole(g, 'loadBalancer')
            ? { points: 1, verdict: 'partial', detail: 'A load balancer is drawn but has no path into the app tier.' }
            : { points: 0, verdict: 'fail', detail: 'No regional load balancer in front of the app tier.' },
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
      id: 'cross-region-replication',
      label: 'Cross-region data replication strategy is named (active-active or active-passive)',
      max: 3,
      run: (g) =>
        keywordAnywhere(g, REPLICATION_KEYWORDS)
          ? { points: 3, verdict: 'pass', detail: 'A cross-region replication strategy is named.' }
          : {
              points: 0,
              verdict: 'fail',
              detail: 'Name whether regions are active-active (multi-leader, faster local writes, needs conflict resolution) or active-passive (one write leader, simpler, slower far-region writes) — "the database is replicated" alone doesn\'t say which.',
            },
    },
    {
      id: 'datastore-present',
      label: 'A datastore is present',
      max: 2,
      run: (g) =>
        hasRole(g, 'datastore')
          ? { points: 2, verdict: 'pass', detail: 'A datastore is present.' }
          : { points: 0, verdict: 'fail', detail: 'No datastore drawn.' },
    },
    {
      id: 'failover-named',
      label: 'A concrete failover mechanism (RPO/RTO or automatic promotion) is named',
      max: 2,
      run: (g) =>
        keywordAnywhere(g, FAILOVER_KEYWORDS)
          ? { points: 2, verdict: 'pass', detail: 'A failover mechanism is named.' }
          : { points: 0, verdict: 'fail', detail: 'Say what actually happens when a region goes down: how a new write leader is chosen, and what data loss (RPO) and downtime (RTO) are expected.' },
    },
    {
      id: 'no-spof-within-region',
      label: 'No single point of failure within a region',
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

const STATEMENT = `Take an existing single-region web application and design how to deploy it across multiple regions (e.g. US, EU, APAC) to cut latency for global users and survive a full regional outage.

Functional requirements:
- Users are routed to their nearest healthy region.
- If a region fails entirely, traffic fails over to another region with minimal data loss.

Non-functional requirements / scale:
- Under 100ms latency for users in each supported region.
- RPO (data lost on failover) of at most a few seconds.
- RTO (time to fully recover after a region fails) of a few minutes.`;

const REFERENCE_APPROACH = `Users are routed by a global, latency-aware layer (DNS-based latency routing, e.g. Route 53, or an anycast global load balancer) to whichever region is closest and currently healthy. Each region runs a full independent stack: its own load balancer, app tier, and a copy of the datastore. Cross-region data replication is either active-passive (one region holds write leadership; the others are read replicas that can be promoted on failover — simpler, but writes from a far region pay the cross-region round trip) or active-active/multi-leader (every region accepts writes locally, replicated to the others — faster local writes, at the cost of needing conflict resolution for concurrent edits to the same record). Failover: health checks detect a region outage, the global routing layer stops sending it traffic, and if that region held write leadership, a replica elsewhere is promoted — accepting a few seconds of potential data loss (RPO) for writes that were in flight, with RTO bounded by how quickly promotion and DNS propagation happen. Redundancy exists both across regions and within each one. The two things interviewers listen for: (1) a replication strategy named with its actual write-latency/conflict trade-off, not just "the database is replicated," and (2) a concrete failover mechanism with an explicit RPO/RTO, not hand-waved.`;

export const MULTI_REGION: DesignProblem = {
  slug: 'design-a-multi-region-deployment',
  track: 'hld',
  title: 'Design a Multi-Region Deployment',
  difficulty: 'Hard',
  statement: STATEMENT,
  rubric: MULTI_REGION_RUBRIC,
  referenceApproach: REFERENCE_APPROACH,
  hints: [
    'Running the same stack in three regions is the easy part. The hard question is: how does a user actually get routed to the right one?',
    'If two regions can both accept writes to the same record, what happens when they disagree?',
    'Use latency-based/geo routing (e.g. Route 53) to the nearest healthy region, and explicitly name either active-passive (one write leader) or active-active (multi-leader, needs conflict resolution) replication, plus an RPO/RTO for failover.',
  ],
};
