import { allNodesLabeled, hasRole, keywordAnywhere, pathExists, redundancyEvidence } from '../rubric/checks.ts';
import type { RubricSpec } from '../rubric/types.ts';
import type { DesignProblem } from '../types.ts';

/**
 * Proximity Service's write-heavy, real-time cousin: locations update every
 * few seconds per user (not "rarely"), so the crux shifts to an in-memory
 * location index plus a persistent connection for pushing updates, instead
 * of a cached, mostly-static geo index.
 */

const WEBSOCKET_KEYWORDS = ['websocket', 'persistent connection', 'long-lived connection'];
const IN_MEMORY_INDEX_KEYWORDS = ['in-memory', 'redis geo', 'in memory index'];
const GEO_INDEX_KEYWORDS = ['geohash', 'quadtree', 'quad-tree'];
const FANOUT_KEYWORDS = ['friend list', 'fan-out', 'fanout', 'subscription'];
const TTL_KEYWORDS = ['ttl', 'expire', 'stale location'];
const WRITE_THROUGHPUT_KEYWORDS = ['write-heavy', 'write heavy', 'high write throughput', 'frequent updates'];

const NEARBY_FRIENDS_RUBRIC: RubricSpec = {
  id: 'design-nearby-friends',
  title: 'Design Nearby Friends — rubric',
  checks: [
    {
      id: 'persistent-connection',
      label: 'A persistent connection (WebSocket) delivers live updates',
      max: 3,
      run: (g) =>
        hasRole(g, 'appServer') && keywordAnywhere(g, WEBSOCKET_KEYWORDS)
          ? { points: 3, verdict: 'pass', detail: 'A persistent connection is named for live updates.' }
          : { points: 0, verdict: 'fail', detail: 'Friends\' positions need to update live on the map — name a persistent connection (WebSocket) rather than the client polling on an interval.' },
    },
    {
      id: 'in-memory-location-index',
      label: 'Current locations live in a fast, in-memory index',
      max: 3,
      run: (g) =>
        keywordAnywhere(g, IN_MEMORY_INDEX_KEYWORDS) || hasRole(g, 'cache')
          ? { points: 3, verdict: 'pass', detail: 'An in-memory location index is present.' }
          : {
              points: 0,
              verdict: 'fail',
              detail: 'A location update every few seconds per user, for millions of users, is far too much write volume for a durable database to be the hot path — hold current location in a fast in-memory store (Redis geo commands).',
            },
    },
    {
      id: 'geo-index-named',
      label: 'A geospatial index scheme is named',
      max: 2,
      run: (g) =>
        keywordAnywhere(g, GEO_INDEX_KEYWORDS)
          ? { points: 2, verdict: 'pass', detail: 'A geospatial indexing scheme is named.' }
          : { points: 0, verdict: 'fail', detail: 'Name how "who is near this location" is actually computed quickly (geohashing, or Redis\'s own geospatial index).' },
    },
    {
      id: 'fanout-named',
      label: 'Updates fan out only to a user\'s actual friends/subscribers',
      max: 3,
      run: (g) =>
        keywordAnywhere(g, FANOUT_KEYWORDS)
          ? { points: 3, verdict: 'pass', detail: 'Scoped fan-out is named.' }
          : {
              points: 0,
              verdict: 'fail',
              detail: 'A location update shouldn\'t broadcast to everyone — name how it\'s scoped to fan out only to that user\'s friends who are actively viewing the map.',
            },
    },
    {
      id: 'stale-location-handling',
      label: 'Stale-location handling (TTL/expiry) is named',
      max: 2,
      run: (g) =>
        keywordAnywhere(g, TTL_KEYWORDS)
          ? { points: 2, verdict: 'pass', detail: 'Stale-location expiry is named.' }
          : { points: 0, verdict: 'fail', detail: 'Say what happens to a location that stops updating (the app was closed) — a TTL so a stale pin eventually disappears instead of showing a friend "here" forever.' },
    },
    {
      id: 'write-volume-acknowledged',
      label: 'The high write throughput of the workload is acknowledged',
      max: 2,
      run: (g) =>
        keywordAnywhere(g, WRITE_THROUGHPUT_KEYWORDS)
          ? { points: 2, verdict: 'pass', detail: 'High write throughput is acknowledged.' }
          : { points: 0, verdict: 'fail', detail: 'Say out loud that this is a write-heavy workload (every active user writes every few seconds) — it\'s the opposite skew from a typical read-heavy proximity search, and should drive different choices.' },
    },
    {
      id: 'lb-in-front',
      label: 'A load balancer sits in front of the connection-handling tier',
      max: 2,
      run: (g) =>
        pathExists(g, 'client', 'loadBalancer') && pathExists(g, 'loadBalancer', 'appServer')
          ? { points: 2, verdict: 'pass', detail: 'Client -> load balancer -> app tier.' }
          : { points: 0, verdict: 'fail', detail: 'Route clients through a load balancer to the connection-handling tier.' },
    },
    {
      id: 'app-tier-redundant',
      label: 'The connection-handling tier has more than one instance',
      max: 1,
      run: (g) =>
        redundancyEvidence(g, 'appServer')
          ? { points: 1, verdict: 'pass', detail: 'The tier is shown as more than one instance.' }
          : { points: 0, verdict: 'fail', detail: 'Show the connection-handling tier as more than one instance.' },
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

const STATEMENT = `Design a "nearby friends" feature (like Snap Map or Facebook's Nearby Friends): each active user's location updates every few seconds, and every user sees their friends' live positions on a map.

Functional requirements:
- A user's client periodically reports its current location.
- Every one of that user's friends who's actively viewing the map sees the update live, without refreshing.
- A friend who closes the app eventually disappears from the map rather than appearing frozen in their last spot forever.

Non-functional requirements / scale:
- Tens of millions of concurrently active users, each writing a location update every few seconds — this is a write-heavy workload, the opposite skew from a typical "search nearby" read path.
- Updates need to feel live (low end-to-end latency from one user's move to their friends seeing it).`;

const REFERENCE_APPROACH = `The scale of location writes (every active user, every few seconds) rules out a durable relational database as the hot path — current location lives in a fast, in-memory store (Redis, using its geospatial commands or a geohash-keyed structure) rather than being written through to a traditional database on every update. Clients hold a persistent WebSocket connection to a connection-handling tier rather than polling on an interval, since polling either wastes requests (polling too often) or feels laggy (polling too rarely); the server pushes an update over the open connection the moment it has one to send. A location update fans out only to that specific user's friends who are both (a) actually friends and (b) currently have the map open — computed by looking up the friend list and cross-referencing which of them have an active connection, not a broadcast to everyone. A TTL on each stored location (e.g. a couple of minutes) means a user who stops sending updates (closed the app, lost connectivity) naturally expires off friends' maps instead of appearing frozen in their last known spot indefinitely. The connection-handling tier sits behind a load balancer and is horizontally scaled, with a mechanism (consistent hashing, or a shared pub/sub layer like Redis Pub/Sub) to route a given user's location updates to whichever server instances are holding that user's friends' WebSocket connections, since a naive design would need every server to see every update.`;

export const NEARBY_FRIENDS: DesignProblem = {
  slug: 'design-nearby-friends',
  track: 'hld',
  title: 'Design Nearby Friends',
  difficulty: 'Hard',
  statement: STATEMENT,
  rubric: NEARBY_FRIENDS_RUBRIC,
  referenceApproach: REFERENCE_APPROACH,
  hints: [
    'Tens of millions of users each writing their location every few seconds — should that hot path write straight through a durable relational database?',
    'A friend closes the app without telling the server. How does their pin ever disappear from your map instead of staying frozen there forever?',
    'Hold current location in a fast in-memory store, push updates over a persistent WebSocket connection to just that user\'s active friends, and expire a location with a TTL if it stops updating.',
  ],
};
