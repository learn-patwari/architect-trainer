import { allNodesLabeled, hasRole, keywordAnywhere, pathExists, redundancyEvidence } from '../rubric/checks.ts';
import type { RubricSpec } from '../rubric/types.ts';
import type { DesignProblem } from '../types.ts';

/**
 * The routing/navigation problem: the crux is offline precomputation over a
 * graph (roads as edges, intersections as nodes) plus tile-based map
 * rendering, distinct from proximity search or live location tracking.
 */

const GRAPH_KEYWORDS = ['graph', 'dijkstra', 'a*', 'a star', 'shortest path'];
const HIERARCHICAL_KEYWORDS = ['hierarchical', 'contraction hierarch', 'precompute', 'precomputed'];
const TILE_KEYWORDS = ['tile', 'tiling', 'map tile'];
const TRAFFIC_KEYWORDS = ['traffic', 'live traffic', 'eta'];
const REROUTE_KEYWORDS = ['reroute', 're-route', 'recalculat'];

const GOOGLE_MAPS_RUBRIC: RubricSpec = {
  id: 'design-google-maps',
  title: 'Design Google Maps — rubric',
  checks: [
    {
      id: 'graph-model-named',
      label: 'The road network is modeled as a graph with a shortest-path algorithm',
      max: 4,
      run: (g) =>
        keywordAnywhere(g, GRAPH_KEYWORDS)
          ? { points: 4, verdict: 'pass', detail: 'A graph model and shortest-path algorithm are named.' }
          : {
              points: 0,
              verdict: 'fail',
              detail: 'Model the road network as a graph (intersections as nodes, road segments as weighted edges) and name a shortest-path algorithm (Dijkstra, A*) as the base for routing.',
            },
    },
    {
      id: 'precomputation-named',
      label: 'Precomputation over the graph is named (not naive Dijkstra at request time)',
      max: 3,
      run: (g) =>
        keywordAnywhere(g, HIERARCHICAL_KEYWORDS)
          ? { points: 3, verdict: 'pass', detail: 'Precomputed/hierarchical routing is named.' }
          : {
              points: 0,
              verdict: 'fail',
              detail: 'Plain Dijkstra over a continent-scale road graph is far too slow at request time — name an offline precomputation scheme (contraction hierarchies, or a coarse-to-fine hierarchical graph) that makes a route query fast.',
            },
    },
    {
      id: 'map-tiling',
      label: 'Map imagery is served as precomputed tiles',
      max: 3,
      run: (g) =>
        keywordAnywhere(g, TILE_KEYWORDS)
          ? { points: 3, verdict: 'pass', detail: 'Map tiling is named.' }
          : { points: 0, verdict: 'fail', detail: 'Rendering the whole map on every request doesn\'t scale — name that map imagery is pre-rendered into tiles at multiple zoom levels and served as static assets.' },
    },
    {
      id: 'cdn-for-tiles',
      label: 'Map tiles are served through a CDN',
      max: 2,
      run: (g) =>
        hasRole(g, 'cdn')
          ? { points: 2, verdict: 'pass', detail: 'A CDN is present for tiles.' }
          : { points: 0, verdict: 'fail', detail: 'Map tiles are static, enormous in aggregate, and read constantly — serve them through a CDN.' },
    },
    {
      id: 'live-traffic',
      label: 'Live traffic/ETA data is incorporated',
      max: 3,
      run: (g) =>
        keywordAnywhere(g, TRAFFIC_KEYWORDS)
          ? { points: 3, verdict: 'pass', detail: 'Live traffic is named.' }
          : { points: 0, verdict: 'fail', detail: 'A static shortest path ignores current congestion — name how live traffic data (from other users\' phones, or third-party feeds) updates edge weights or the ETA.' },
    },
    {
      id: 'reroute-named',
      label: 'Rerouting when a user deviates from the route is named',
      max: 2,
      run: (g) =>
        keywordAnywhere(g, REROUTE_KEYWORDS)
          ? { points: 2, verdict: 'pass', detail: 'Rerouting behavior is named.' }
          : { points: 0, verdict: 'fail', detail: 'Say what happens when a driver misses a turn or the route becomes suboptimal mid-trip — the client detects the deviation and requests a new route.' },
    },
    {
      id: 'lb-in-front',
      label: 'A load balancer sits in front of the routing service',
      max: 2,
      run: (g) =>
        pathExists(g, 'client', 'loadBalancer') && pathExists(g, 'loadBalancer', 'appServer')
          ? { points: 2, verdict: 'pass', detail: 'Client -> load balancer -> app tier.' }
          : { points: 0, verdict: 'fail', detail: 'Route client requests through a load balancer to the routing service.' },
    },
    {
      id: 'app-tier-redundant',
      label: 'The routing/app tier has more than one instance',
      max: 1,
      run: (g) =>
        redundancyEvidence(g, 'appServer')
          ? { points: 1, verdict: 'pass', detail: 'The routing tier is shown as more than one instance.' }
          : { points: 0, verdict: 'fail', detail: 'Show the routing tier as more than one instance.' },
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

const STATEMENT = `Design the core of a navigation service (like Google Maps): given a start and end point, return a route, an ETA, and turn-by-turn directions, updated live as traffic changes.

Functional requirements:
- getRoute(start, end) returns a path and an estimated arrival time.
- The route reflects current traffic conditions, not just static road distance.
- Map imagery is viewable at any zoom level, panned smoothly.
- If a driver deviates from the given route, the system offers a new one.

Non-functional requirements / scale:
- A continent-scale road network: hundreds of millions of road segments and intersections.
- Route requests need a sub-second response — nobody waits several seconds for directions.
- Billions of map-tile views per day, globally.`;

const REFERENCE_APPROACH = `The road network is modeled as a graph: intersections (or road segment endpoints) are nodes, road segments are directed weighted edges (weight = expected travel time), and a shortest-path algorithm (Dijkstra, or A* with a geographic distance heuristic) finds a route on that graph. Running plain Dijkstra over a continent-scale graph at request time is far too slow, so the graph is preprocessed offline into a hierarchy (contraction hierarchies is the real-world technique here): pre-compute shortcut edges between important "highway-scale" nodes so a query can skip most of the fine-grained local graph and only expand it near the start and end points, cutting query time from seconds to milliseconds. Map imagery itself is a separate concern from routing: it's pre-rendered offline into tiles (small square images) at multiple zoom levels, stored as static objects, and served through a CDN — the client requests only the tiles for its current viewport and zoom level and stitches them together, rather than the server rendering a custom image per request. Live traffic conditions (aggregated from other users' phones reporting speed/position, plus third-party feeds) continuously update edge weights in the routing graph, so getRoute reflects current congestion rather than static road-distance; a client that detects the driver has deviated from the given path (its GPS position no longer matches the route) requests a fresh route computed from its new current position. The routing service itself sits behind a load balancer, horizontally scaled, since route computation is CPU-bound and independent per request.`;

export const GOOGLE_MAPS: DesignProblem = {
  slug: 'design-google-maps',
  track: 'hld',
  title: 'Design Google Maps',
  difficulty: 'Hard',
  statement: STATEMENT,
  rubric: GOOGLE_MAPS_RUBRIC,
  referenceApproach: REFERENCE_APPROACH,
  hints: [
    'Plain Dijkstra over a graph with hundreds of millions of nodes, at request time, for a sub-second response — does that actually work at this scale?',
    'Rendering a custom map image for every request, at every possible pan/zoom, doesn\'t scale either. What\'s served instead, and from where?',
    'Model roads as a weighted graph and precompute a hierarchy over it (contraction hierarchies) for fast routing; serve map imagery as precomputed tiles through a CDN; and update edge weights from live traffic data.',
  ],
};
