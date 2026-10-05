import { allNodesLabeled, hasRole, keywordAnywhere, pathExists, redundancyEvidence } from '../rubric/checks.ts';
import type { RubricSpec } from '../rubric/types.ts';
import type { DesignProblem } from '../types.ts';

/**
 * The Yelp-shaped problem: the crux is the geospatial index (geohash or a
 * quadtree) and treating business data as effectively read-only/cacheable,
 * distinct from ride-sharing (real-time moving points, matching).
 */

const GEO_INDEX_KEYWORDS = ['geohash', 'quadtree', 'quad-tree', 's2', 'geospatial index'];
const PRECOMPUTE_KEYWORDS = ['precomput', 'cached radius', 'popular area'];
const READ_HEAVY_KEYWORDS = ['read-heavy', 'read heavy', 'rarely change', 'infrequently updated'];
const RADIUS_EXPAND_KEYWORDS = ['expand the radius', 'expanding search', 'widen the search'];

const PROXIMITY_SERVICE_RUBRIC: RubricSpec = {
  id: 'design-a-proximity-service',
  title: 'Design a Proximity Service — rubric',
  checks: [
    {
      id: 'geo-index-named',
      label: 'A geospatial index is named (geohash or a quadtree)',
      max: 4,
      run: (g) =>
        keywordAnywhere(g, GEO_INDEX_KEYWORDS)
          ? { points: 4, verdict: 'pass', detail: 'A geospatial indexing scheme is named.' }
          : { points: 0, verdict: 'fail', detail: 'A plain "find businesses within 5km" query doesn\'t scale as a full-table scan — name the actual index (geohash or a quadtree) that makes nearby lookups fast.' },
    },
    {
      id: 'cache-layer',
      label: 'A cache sits in front of the geo lookup',
      max: 3,
      run: (g) =>
        hasRole(g, 'cache')
          ? { points: 3, verdict: 'pass', detail: 'A cache is present.' }
          : { points: 0, verdict: 'fail', detail: 'Business location data changes rarely and reads dominate massively — cache popular-area lookups instead of hitting the index on every request.' },
    },
    {
      id: 'lb-in-front',
      label: 'A load balancer sits in front of the app tier',
      max: 2,
      run: (g) =>
        pathExists(g, 'client', 'loadBalancer') && pathExists(g, 'loadBalancer', 'appServer')
          ? { points: 2, verdict: 'pass', detail: 'Client -> load balancer -> app tier.' }
          : { points: 0, verdict: 'fail', detail: 'Route the client through a load balancer to the app tier.' },
    },
    {
      id: 'radius-expansion',
      label: 'Sparse-area handling (expanding search radius) is named',
      max: 3,
      run: (g) =>
        keywordAnywhere(g, RADIUS_EXPAND_KEYWORDS)
          ? { points: 3, verdict: 'pass', detail: 'Search-radius expansion is named.' }
          : {
              points: 0,
              verdict: 'fail',
              detail: 'A fixed grid cell (or a fixed geohash precision) can come up empty in a sparse rural area — name expanding the search to neighboring cells/coarser precision when too few results are found.',
            },
    },
    {
      id: 'datastore-present',
      label: 'A datastore holds the underlying business/location records',
      max: 2,
      run: (g) =>
        hasRole(g, 'datastore')
          ? { points: 2, verdict: 'pass', detail: 'A datastore is present.' }
          : { points: 0, verdict: 'fail', detail: 'Name the datastore holding the actual business records the geo-index points back into.' },
    },
    {
      id: 'read-heavy-acknowledged',
      label: 'The read:write skew is explicitly acknowledged',
      max: 2,
      run: (g) =>
        keywordAnywhere(g, READ_HEAVY_KEYWORDS)
          ? { points: 2, verdict: 'pass', detail: 'Read-heavy skew is named.' }
          : { points: 0, verdict: 'fail', detail: 'Say out loud that this workload is overwhelmingly read-heavy relative to writes — it justifies the caching and precomputation choices.' },
    },
    {
      id: 'app-tier-redundant',
      label: 'The app tier has more than one instance',
      max: 1,
      run: (g) =>
        redundancyEvidence(g, 'appServer')
          ? { points: 1, verdict: 'pass', detail: 'The app tier is shown as more than one instance.' }
          : { points: 0, verdict: 'fail', detail: 'Show the app tier as more than one instance.' },
    },
    {
      id: 'all-labeled',
      label: 'Every node is labeled',
      max: 3,
      run: (g) => {
        const { labeled, total } = allNodesLabeled(g);
        if (total === 0) return { points: 0, verdict: 'fail', detail: 'Nothing drawn yet.' };
        const points = Math.round((3 * labeled) / total);
        const verdict = labeled === total ? 'pass' : labeled === 0 ? 'fail' : 'partial';
        return { points, verdict, detail: labeled === total ? 'Every shape is labeled.' : `${total - labeled} shape(s) have no label.` };
      },
    },
  ],
};

const STATEMENT = `Design a proximity service (like Yelp): given a user's location and a search radius, return nearby businesses, sorted by distance.

Functional requirements:
- searchNearby(lat, lng, radius) returns businesses within that radius, sorted by distance.
- Business owners can add/update their listing (location changes rarely once set).
- If a search area has very few businesses (a sparse rural area), still return reasonable results rather than nothing.

Non-functional requirements / scale:
- Extremely read-heavy: searches vastly outnumber listing updates.
- Low read latency (this backs an interactive map UI).
- Hundreds of millions of business listings, globally distributed.`;

const REFERENCE_APPROACH = `A naive "scan every business and compute distance" doesn't scale, so locations are indexed with a geospatial structure — most commonly geohashing (encode lat/lng into a string prefix where nearby locations share a prefix) or a quadtree (recursively subdivide space into cells, denser where businesses are denser). A search query encodes the user's location the same way and looks up businesses in the matching cell(s) plus their immediate neighbors, avoiding a full scan. Because business locations change rarely and the read:write ratio is extreme, results for popular areas are cached aggressively (a cache in front of the geo-index lookup) — this workload is about as read-heavy and cacheable as it gets, and that fact should drive the caching decision explicitly rather than being an afterthought. For a sparse area where the initial cell has too few results, the search expands outward — either to a coarser geohash precision or to neighboring quadtree cells — rather than returning nothing just because the fixed initial radius happened to be too small for that area's density. The underlying business records (name, address, hours, categories) live in a normal datastore, with the geo-index pointing back to them by ID rather than duplicating the full record inside the index.`;

export const PROXIMITY_SERVICE: DesignProblem = {
  slug: 'design-a-proximity-service',
  track: 'hld',
  title: 'Design a Proximity Service',
  difficulty: 'Medium',
  statement: STATEMENT,
  rubric: PROXIMITY_SERVICE_RUBRIC,
  referenceApproach: REFERENCE_APPROACH,
  hints: [
    'Scanning every business and computing distance for each one doesn\'t scale to hundreds of millions of listings. What structure lets you jump straight to "businesses near here"?',
    'This workload is read-heavy almost to an extreme, and business locations barely ever change. What does that suggest about where a cache belongs?',
    'Index locations with geohashing or a quadtree, cache popular-area results aggressively given the read-heavy skew, and expand the search to neighboring cells when a sparse area returns too few results.',
  ],
};
