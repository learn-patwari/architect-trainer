import { allNodesLabeled, hasRole, keywordAnywhere, nodesWithRole, pathExists, redundancyEvidence } from '../rubric/checks.ts';
import type { RubricSpec } from '../rubric/types.ts';
import type { DesignProblem } from '../types.ts';

/**
 * The third HLD problem: a stateful real-time connection tier, which the URL
 * shortener and news feed don't exercise. Still reuses every existing primitive.
 */

const SPECIFIC_DATASTORE_KEYWORDS = ['postgres', 'mysql', 'dynamodb', 'cassandra', 'mongodb', 'cockroachdb', 'sqlite', 'maria', 'aurora', 'spanner'];
const PRESENCE_KEYWORDS = ['presence', 'online', 'heartbeat', 'ttl'];
const OFFLINE_KEYWORDS = ['offline queue', 'push notification', 'store and forward', 'store-and-forward', 'undelivered', 'offline'];

const CHAT_RUBRIC: RubricSpec = {
  id: 'design-a-chat-system',
  title: 'Design a Chat System — rubric',
  checks: [
    {
      id: 'load-balancer',
      label: 'Load balancer in front of the gateway tier',
      max: 3,
      run: (g) =>
        pathExists(g, 'loadBalancer', 'appServer')
          ? { points: 3, verdict: 'pass', detail: 'A load balancer sits in front of the gateway tier.' }
          : hasRole(g, 'loadBalancer')
            ? { points: 1, verdict: 'partial', detail: 'A load balancer is drawn but has no path into the gateway tier.' }
            : { points: 0, verdict: 'fail', detail: 'No load balancer in front of the connection/gateway tier.' },
    },
    {
      id: 'gateway-tier',
      label: 'A connection/gateway tier for real-time delivery is present',
      max: 2,
      run: (g) =>
        hasRole(g, 'appServer')
          ? { points: 2, verdict: 'pass', detail: 'A gateway/connection tier is present.' }
          : { points: 0, verdict: 'fail', detail: 'No gateway or connection-handling tier drawn.' },
    },
    {
      id: 'broker-routes-messages',
      label: 'A broker routes messages between gateway instances',
      max: 3,
      run: (g) => {
        const wired = pathExists(g, 'appServer', 'queue');
        if (wired) return { points: 3, verdict: 'pass', detail: 'Messages are routed through a broker so any gateway instance can deliver to any connected recipient.' };
        if (hasRole(g, 'queue')) return { points: 1, verdict: 'partial', detail: 'A broker is drawn but not wired to the gateway tier.' };
        return {
          points: 0,
          verdict: 'fail',
          detail: 'No broker between gateway instances — with many stateful gateway servers, the sender and recipient are often connected to different instances, and only a broker lets any instance deliver to any connected client.',
        };
      },
    },
    {
      id: 'message-store-named',
      label: 'A datastore for message history is present and a specific technology named',
      max: 3,
      run: (g) => {
        const stores = nodesWithRole(g, 'datastore');
        if (stores.length === 0) return { points: 0, verdict: 'fail', detail: 'No datastore drawn to persist message history.' };
        const specific = stores.some((n) => SPECIFIC_DATASTORE_KEYWORDS.some((k) => n.label.toLowerCase().includes(k)));
        return specific
          ? { points: 3, verdict: 'pass', detail: 'A specific datastore technology is named for message history.' }
          : { points: 1, verdict: 'partial', detail: 'A datastore is drawn but only labeled generically — name the actual technology.' };
      },
    },
    {
      id: 'presence',
      label: 'A presence mechanism is named',
      max: 2,
      run: (g) =>
        keywordAnywhere(g, PRESENCE_KEYWORDS)
          ? { points: 2, verdict: 'pass', detail: 'A presence mechanism is named.' }
          : { points: 0, verdict: 'fail', detail: 'Name how online/offline presence is tracked (e.g. a heartbeat with a TTL key in a cache) — a stale "online" status after an ungraceful disconnect is a classic bug here.' },
    },
    {
      id: 'offline-delivery',
      label: 'Offline delivery is handled',
      max: 2,
      run: (g) =>
        keywordAnywhere(g, OFFLINE_KEYWORDS)
          ? { points: 2, verdict: 'pass', detail: 'Offline delivery is addressed.' }
          : { points: 0, verdict: 'fail', detail: 'Say what happens when the recipient is offline — messages must still be delivered (from storage, or via a push notification) once they reconnect.' },
    },
    {
      id: 'no-spof',
      label: 'No single point of failure across load balancer / gateway / datastore',
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

const STATEMENT = `Design a real-time 1:1 and small-group chat system (a simplified WhatsApp/Slack DM). Users send and receive messages with low latency when both are online; messages are still delivered if the recipient is offline when sent.

Functional requirements:
- Send a message to another user or a small group.
- Receive messages in near real time while online.
- See other users' online/offline presence.
- Message history is available when reopening a conversation.

Non-functional requirements / scale:
- 50M daily active users.
- ~40 messages per active user per day.
- Delivery latency under 500ms when both parties are online.
- No message should be lost, even if the recipient is offline for days.`;

const REFERENCE_APPROACH = `Clients hold a persistent connection (WebSocket) to a gateway tier behind a load balancer. Because each gateway instance only knows about the connections it personally holds, an outgoing message is published to a broker (Kafka or NATS) keyed by recipient rather than delivered directly — every gateway instance subscribes to the broker, and whichever instance holds the recipient's live connection delivers it. Every message is also persisted to a write-heavy datastore (e.g. Cassandra) for history and for offline delivery: if the recipient isn't currently connected, the message simply waits there (or in an explicit offline queue) and is pushed to them on reconnect, with a mobile push notification covering the case where the app isn't even running. Presence is tracked with a heartbeat: each connected client's gateway refreshes a short-TTL "online" key in a cache (Redis) on an interval, so an ungraceful disconnect (a dropped connection with no clean close) still expires to "offline" automatically instead of leaving a stale status forever. Redundancy: multiple load balancer, gateway, and datastore instances, so no single node loss drops connections or loses messages. The two things interviewers listen for specifically: (1) a broker (not direct gateway-to-gateway calls) solving "which instance holds this recipient's connection," and (2) an explicit, correct story for offline delivery rather than assuming the recipient is always connected.`;

export const CHAT_SYSTEM: DesignProblem = {
  slug: 'design-a-chat-system',
  track: 'hld',
  title: 'Design a Chat System',
  difficulty: 'Hard',
  statement: STATEMENT,
  rubric: CHAT_RUBRIC,
  referenceApproach: REFERENCE_APPROACH,
  hints: [
    'If a sender and recipient are connected to two different gateway servers, how does the message actually get from one server to the other?',
    'What happens to a message if the recipient isn\'t connected to anything at all right now?',
    'Route messages through a broker (Kafka/NATS) keyed by recipient so any gateway instance can deliver to any live connection, persist every message for offline delivery, and track presence with a short-TTL heartbeat key.',
  ],
};
