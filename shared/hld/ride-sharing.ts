import { allNodesLabeled, hasRole, keywordAnywhere, pathExists, redundancyEvidence } from '../rubric/checks.ts';
import type { RubricSpec } from '../rubric/types.ts';
import type { DesignProblem } from '../types.ts';

/**
 * The canonical "match a rider to a nearby driver" problem — the crux is a
 * geospatial index, and separating fast-changing live location from durable
 * trip history. Reuses every existing primitive.
 */

const GEO_INDEX_KEYWORDS = ['geohash', 'quadtree', 's2 cell', 'geospatial index', 'geo index'];
const MATCHING_KEYWORDS = ['nearest driver', 'matching algorithm', 'dispatch', 'greedy matching'];

const RIDE_SHARING_RUBRIC: RubricSpec = {
  id: 'design-a-ride-sharing-service',
  title: 'Design a Ride-Sharing Service — rubric',
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
      id: 'geo-index-named',
      label: 'A geospatial index for finding nearby drivers is named',
      max: 3,
      run: (g) =>
        keywordAnywhere(g, GEO_INDEX_KEYWORDS)
          ? { points: 3, verdict: 'pass', detail: 'A geospatial indexing mechanism is named.' }
          : {
              points: 0,
              verdict: 'fail',
              detail: 'Name how "nearby drivers" is actually computed fast (geohash, a quadtree, S2 cells) — a linear scan over every driver\'s location does not scale.',
            },
    },
    {
      id: 'live-location-cache',
      label: 'A fast cache holds live driver locations, wired to the app tier',
      max: 3,
      run: (g) => {
        const wired = pathExists(g, 'appServer', 'cache');
        if (wired) return { points: 3, verdict: 'pass', detail: 'Live driver locations are cached on the hot path.' };
        if (hasRole(g, 'cache')) return { points: 1, verdict: 'partial', detail: 'A cache is drawn but not wired to the app tier.' };
        return {
          points: 0,
          verdict: 'fail',
          detail: 'Driver locations change every few seconds — writing every update straight into the durable trip database would overwhelm it. Name a fast in-memory store for live location.',
        };
      },
    },
    {
      id: 'trip-datastore',
      label: 'A durable datastore for trip records is present',
      max: 2,
      run: (g) =>
        hasRole(g, 'datastore')
          ? { points: 2, verdict: 'pass', detail: 'A durable datastore is present.' }
          : { points: 0, verdict: 'fail', detail: 'No datastore drawn for trip records.' },
    },
    {
      id: 'matching-strategy',
      label: 'A driver-matching/dispatch strategy is named',
      max: 2,
      run: (g) =>
        keywordAnywhere(g, MATCHING_KEYWORDS)
          ? { points: 2, verdict: 'pass', detail: 'A matching/dispatch strategy is named.' }
          : { points: 0, verdict: 'fail', detail: 'Say how a driver is actually chosen once you have a set of nearby candidates (nearest available, or a dispatch algorithm) — not just that "a driver is assigned."' },
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

const STATEMENT = `Design a ride-sharing service: a rider requests a trip, the system matches them with a nearby available driver, both parties see live location during the trip, and a fare is calculated at the end.

Functional requirements:
- A rider requests a ride with a pickup and drop-off location.
- The system finds and assigns a nearby available driver.
- Both rider and driver see each other's live location during the trip.
- A fare is calculated and charged when the trip ends.

Non-functional requirements / scale:
- Millions of active drivers, each sending a location update every few seconds.
- Matching a rider to a driver must be fast — seconds, not tens of seconds.
- Demand is regionally spiky (a downtown area at rush hour) without the system falling over.`;

const REFERENCE_APPROACH = `Driver location updates flow through the app tier into a fast in-memory geospatial store (Redis, using geohash-encoded sorted sets, or a dedicated geo-index service) rather than the durable trip database — location changes every few seconds and "find nearby drivers" must be sub-second, which a row-store query over millions of driver rows can't reliably deliver. To find candidates for a ride request, the app tier queries the geo-index for drivers within nearby geohash cells (or S2 cell neighbors), then runs a matching/dispatch step (nearest available driver, or a slightly smarter batched dispatch that reduces empty repositioning) to assign one. Trip records — once a ride is requested, matched, and completed — persist in a durable datastore, separate from the ephemeral location cache. Redundancy across the load balancer, app tier, and datastore. The two things interviewers listen for: (1) a named geospatial index, not "we query nearby drivers" hand-waved, and (2) keeping the hot, high-volume location-write path out of the durable trip store.`;

export const RIDE_SHARING: DesignProblem = {
  slug: 'design-a-ride-sharing-service',
  track: 'hld',
  title: 'Design a Ride-Sharing Service',
  difficulty: 'Hard',
  statement: STATEMENT,
  rubric: RIDE_SHARING_RUBRIC,
  referenceApproach: REFERENCE_APPROACH,
  hints: [
    '"Find nearby drivers" — what happens to that query if you scan every driver\'s location row by row?',
    'Driver locations update every few seconds from millions of drivers. Should those writes go straight into your durable trip database?',
    'Index live driver locations with a geospatial structure (geohash, a quadtree, or S2 cells) in a fast in-memory store, kept separate from the durable datastore that holds completed trip records.',
  ],
};
