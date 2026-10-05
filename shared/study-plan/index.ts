import type { Track } from '../types.ts';

/**
 * A recommended order to work through everything else in this app, not new content
 * of its own — every step links to a concept, the tools page, the estimator, or a
 * problem that already exists elsewhere. The phase order follows what prep sources
 * (DesignGurus' roadmap, Hello Interview, GeeksforGeeks) converge on: foundations
 * before building blocks, building blocks before practice, easy practice before
 * hard, and hard practice before timed mock rounds — see the "Read more" links on
 * the page itself for the sources. Not secret — imported directly by web/src, same
 * as concepts/tools/estimate.
 */

export type StudyStepKind = 'concept' | 'tools' | 'estimate' | 'problem' | 'practice';

export interface StudyStep {
  id: string;
  kind: StudyStepKind;
  title: string;
  detail: string;
  href: string;
  track?: Track;
  slug?: string;
}

export interface StudyPhase {
  id: string;
  title: string;
  blurb: string;
  steps: StudyStep[];
}

export const STUDY_PLAN: StudyPhase[] = [
  {
    id: 'foundations',
    title: '1. Foundations',
    blurb:
      "Before drawing anything, get the request lifecycle and the core trade-offs into your head — most designs are the same handful of ideas recombined. Skipping this to rush into practice problems is the single most common reason prep stalls out.",
    steps: [
      { id: 'f1', kind: 'concept', title: 'CAP theorem', detail: 'The trade-off every distributed system data decision traces back to.', href: '/concepts/cap-theorem' },
      { id: 'f2', kind: 'concept', title: 'Consistency models', detail: 'What "consistent" actually means, and which flavor a given feature needs.', href: '/concepts/consistency-models' },
      { id: 'f3', kind: 'concept', title: 'Load balancing algorithms', detail: 'How a request even finds its way to an app server.', href: '/concepts/load-balancing-algorithms' },
      { id: 'f4', kind: 'concept', title: 'Caching strategies', detail: 'Where a cache goes, and what can go stale when you add one.', href: '/concepts/caching-strategies' },
      { id: 'f5', kind: 'estimate', title: 'Capacity estimation', detail: 'The back-of-envelope math (QPS, storage, bandwidth) every HLD round opens with.', href: '/estimate' },
    ],
  },
  {
    id: 'building-blocks',
    title: '2. Building blocks',
    blurb:
      'Six or eight reusable components compose almost every design you\'ll be asked for. Know what each one is good at, what it costs, and a real product that runs it — not just the name.',
    steps: [
      { id: 'b1', kind: 'tools', title: 'Tools reference', detail: 'Databases, queues, caches, and infra — pros, cons, and a concrete "use it when."', href: '/tools' },
      { id: 'b2', kind: 'concept', title: 'Partitioning / sharding', detail: 'How data spreads across more than one node.', href: '/concepts/partitioning-sharding' },
      { id: 'b3', kind: 'concept', title: 'Replication', detail: 'How data survives losing a node.', href: '/concepts/replication' },
      { id: 'b4', kind: 'concept', title: 'Rate limiting algorithms', detail: 'Protecting a system from its own callers.', href: '/concepts/rate-limiting' },
      { id: 'b5', kind: 'concept', title: 'Back-pressure', detail: 'What happens when a producer outruns a consumer.', href: '/concepts/back-pressure' },
    ],
  },
  {
    id: 'easy-hld',
    title: '3. First HLD rounds — easy',
    blurb:
      'Start with problems that have few moving parts, so the framework (requirements → estimate → API → data model → high level → deep dive → trade-offs) is the thing you\'re practicing, not the domain.',
    steps: [
      { id: 'ehld1', kind: 'problem', track: 'hld', slug: 'design-a-pastebin', title: 'Design a Pastebin', detail: 'The URL-shortener skeleton, plus one wrinkle: variable-sized blobs.', href: '/problems/hld/design-a-pastebin' },
      { id: 'ehld2', kind: 'problem', track: 'hld', slug: 'design-a-unique-id-generator', title: 'Design a Unique ID Generator', detail: 'One stateless service, one focused idea — no datastore to juggle.', href: '/problems/hld/design-a-unique-id-generator' },
      { id: 'ehld3', kind: 'problem', track: 'hld', slug: 'design-a-url-shortener', title: 'Design a URL Shortener', detail: 'The classic first full round — most people\'s very first system design problem.', href: '/problems/hld/design-a-url-shortener' },
    ],
  },
  {
    id: 'lld-foundations',
    title: '4. LLD foundations: OOP & design patterns',
    blurb:
      "This is the part most people skip and then feel it on every LLD round: a class diagram gets judged against these ideas whether or not the interviewer names them. Read these before your first LLD problem, not after — recognizing \"this needs Strategy\" while you're still gathering requirements is what separates a fast, confident round from thirty stalled minutes.",
    steps: [
      { id: 'lf1', kind: 'concept', title: 'OOP fundamentals', detail: 'Encapsulation, abstraction, inheritance, polymorphism — the four pillars every diagram is judged against.', href: '/concepts/oop-fundamentals' },
      { id: 'lf2', kind: 'concept', title: 'SOLID principles', detail: 'Five rules that keep a class design tolerant of the next change.', href: '/concepts/solid-principles' },
      { id: 'lf3', kind: 'concept', title: 'Strategy pattern', detail: 'The single most useful pattern in an LLD interview — swappable algorithms behind one interface.', href: '/concepts/strategy-pattern' },
      { id: 'lf4', kind: 'concept', title: 'State pattern', detail: 'For anything whose valid operations depend on what mode it\'s in (an ATM, a vending machine).', href: '/concepts/state-pattern' },
      { id: 'lf5', kind: 'concept', title: 'Factory pattern', detail: 'Centralizing "which concrete class do I construct here" in one place.', href: '/concepts/factory-pattern' },
      { id: 'lf6', kind: 'concept', title: 'Singleton pattern', detail: 'Exactly one instance — and why it\'s the most over-reached-for pattern in these interviews.', href: '/concepts/singleton-pattern' },
      { id: 'lf7', kind: 'concept', title: 'Observer pattern', detail: 'For any "notify X when Y happens" requirement.', href: '/concepts/observer-pattern' },
      { id: 'lf8', kind: 'concept', title: 'Adapter pattern', detail: 'Wrapping a class you can\'t change to fit an interface you need.', href: '/concepts/adapter-pattern' },
      { id: 'lf9', kind: 'concept', title: 'Decorator pattern', detail: 'Stacking optional behavior onto an object at runtime.', href: '/concepts/decorator-pattern' },
      { id: 'lf10', kind: 'concept', title: 'Command pattern', detail: 'For undo/redo and task-queue requirements.', href: '/concepts/command-pattern' },
    ],
  },
  {
    id: 'easy-lld',
    title: '5. First LLD rounds — easy',
    blurb: 'Class design has its own on-ramp: get comfortable naming an interface and giving it two implementors before tackling concurrency or bigger object graphs.',
    steps: [
      { id: 'elld1', kind: 'problem', track: 'lld', slug: 'design-tic-tac-toe', title: 'Design Tic-Tac-Toe', detail: 'The smallest complete object model: board, players, a win condition.', href: '/problems/lld/design-tic-tac-toe' },
      { id: 'elld2', kind: 'problem', track: 'lld', slug: 'design-a-library-management-system', title: 'Design a Library Management System', detail: 'One clear Strategy seam (search), one clear entity graph.', href: '/problems/lld/design-a-library-management-system' },
      { id: 'elld3', kind: 'problem', track: 'lld', slug: 'design-an-atm-machine', title: 'Design an ATM Machine', detail: 'The classic first introduction to the State pattern.', href: '/problems/lld/design-an-atm-machine' },
    ],
  },
  {
    id: 'medium',
    title: '6. Medium rounds, both tracks',
    blurb: 'Now add the complications: sharding decisions, concurrency, a second or third design pattern in the same diagram.',
    steps: [
      { id: 'm1', kind: 'problem', track: 'hld', slug: 'design-a-web-crawler', title: 'Design a Web Crawler', detail: 'Politeness, dedup, and a frontier queue.', href: '/problems/hld/design-a-web-crawler' },
      { id: 'm1b', kind: 'problem', track: 'hld', slug: 'design-a-typeahead-system', title: 'Design a Typeahead / Autocomplete System', detail: 'An offline/online split — a trie built offline, served as a pure in-memory read.', href: '/problems/hld/design-a-typeahead-system' },
      { id: 'm1c', kind: 'problem', track: 'hld', slug: 'design-a-notification-system', title: 'Design a Notification System', detail: 'Fanning out to isolated, independently-failing delivery channels.', href: '/problems/hld/design-a-notification-system' },
      { id: 'm2', kind: 'problem', track: 'lld', slug: 'design-a-parking-lot', title: 'Design a Parking Lot', detail: 'The most commonly asked LLD question, full stop.', href: '/problems/lld/design-a-parking-lot' },
      { id: 'm3', kind: 'problem', track: 'lld', slug: 'design-a-rate-limiter', title: 'Design a Rate Limiter', detail: 'Class-level design of an algorithm, not just infrastructure.', href: '/problems/lld/design-a-rate-limiter' },
      { id: 'm4', kind: 'problem', track: 'lld', slug: 'design-an-lru-cache', title: 'Design an LRU Cache', detail: 'The O(1) get/put data-structure combo.', href: '/problems/lld/design-an-lru-cache' },
      { id: 'm4b', kind: 'problem', track: 'lld', slug: 'design-an-in-memory-file-system', title: 'Design an In-Memory File System', detail: 'The canonical Composite-pattern problem.', href: '/problems/lld/design-an-in-memory-file-system' },
      { id: 'm4c', kind: 'problem', track: 'lld', slug: 'design-a-movie-ticket-booking-system', title: 'Design a Movie Ticket Booking System', detail: 'Seat-locking concurrency plus a pricing Strategy seam.', href: '/problems/lld/design-a-movie-ticket-booking-system' },
      { id: 'm5', kind: 'problem', track: 'lld', slug: 'design-a-vending-machine', title: 'Design a Vending Machine', detail: 'A second state-machine problem, with inventory and change-making added.', href: '/problems/lld/design-a-vending-machine' },
      { id: 'm6', kind: 'problem', track: 'lld', slug: 'design-splitwise', title: 'Design Splitwise', detail: 'Ledger modeling and a debt-simplification algorithm.', href: '/problems/lld/design-splitwise' },
      { id: 'm7', kind: 'problem', track: 'hld', slug: 'design-consistent-hashing', title: 'Design Consistent Hashing', detail: 'The ring, virtual nodes, and replication — as the answer itself, not a supporting detail.', href: '/problems/hld/design-consistent-hashing' },
      { id: 'm8', kind: 'problem', track: 'hld', slug: 'design-a-distributed-rate-limiter', title: 'Design a Distributed Rate Limiter', detail: 'The infra version: a shared store and atomic counters across a whole fleet.', href: '/problems/hld/design-a-distributed-rate-limiter' },
      { id: 'm9', kind: 'problem', track: 'hld', slug: 'design-a-proximity-service', title: 'Design a Proximity Service', detail: 'Geohashing/quadtrees for "find things near me," and an extreme read:write skew.', href: '/problems/hld/design-a-proximity-service' },
      { id: 'm10', kind: 'problem', track: 'hld', slug: 'design-a-hotel-reservation-system', title: 'Design a Hotel Reservation System', detail: 'Inventory holds with a TTL, and an explicit overbooking policy.', href: '/problems/hld/design-a-hotel-reservation-system' },
      { id: 'm11', kind: 'problem', track: 'hld', slug: 'design-a-real-time-gaming-leaderboard', title: 'Design a Real-time Gaming Leaderboard', detail: 'A sorted-set structure that stays ordered incrementally, sharded at scale.', href: '/problems/hld/design-a-real-time-gaming-leaderboard' },
      { id: 'm12', kind: 'problem', track: 'hld', slug: 'design-a-digital-wallet', title: 'Design a Digital Wallet', detail: 'Double-entry ledger modeling — the internal-balance cousin of a payment system.', href: '/problems/hld/design-a-digital-wallet' },
      { id: 'm13', kind: 'problem', track: 'hld', slug: 'design-a-metrics-monitoring-system', title: 'Design a Metrics Monitoring and Alerting System', detail: 'A time-series-shaped store, downsampling, and alerting decoupled from ingestion.', href: '/problems/hld/design-a-metrics-monitoring-system' },
      { id: 'm14', kind: 'problem', track: 'lld', slug: 'design-a-grocery-store-system', title: 'Design a Grocery Store System', detail: 'A Strategy seam for pluggable discount rules, plus atomic checkout.', href: '/problems/lld/design-a-grocery-store-system' },
      { id: 'm15', kind: 'problem', track: 'lld', slug: 'design-a-blackjack-game', title: 'Design a Blackjack Game', detail: 'State pattern for round phases, with hand-value calculation pulled out cleanly.', href: '/problems/lld/design-a-blackjack-game' },
      { id: 'm16', kind: 'problem', track: 'lld', slug: 'design-a-shipping-locker-system', title: 'Design a Shipping Locker System', detail: 'Per-locker state machine plus a swappable size-allocation strategy.', href: '/problems/lld/design-a-shipping-locker-system' },
      { id: 'm17', kind: 'problem', track: 'lld', slug: 'design-a-restaurant-management-system', title: 'Design a Restaurant Management System', detail: 'Observer pattern for order-status fan-out, layered on a State-pattern order lifecycle.', href: '/problems/lld/design-a-restaurant-management-system' },
    ],
  },
  {
    id: 'hard',
    title: '7. Hard rounds & specialized topics',
    blurb: 'The concepts that only come up in the harder, more specialized designs — read these alongside the problems that need them, not before.',
    steps: [
      { id: 'h1', kind: 'concept', title: 'Consensus (Paxos / Raft)', detail: 'How multiple nodes agree on one truth.', href: '/concepts/consensus' },
      { id: 'h1b', kind: 'concept', title: 'Leader election', detail: 'The narrower "pick exactly one coordinator" problem consensus protocols solve as one phase of themselves.', href: '/concepts/leader-election' },
      { id: 'h2', kind: 'concept', title: 'Sharding keys & hot partitions', detail: 'How a "correct" shard key still goes wrong.', href: '/concepts/hot-partitions' },
      { id: 'h3', kind: 'concept', title: 'Change Data Capture (CDC)', detail: 'Streaming a database\'s own writes to everything else that needs them.', href: '/concepts/change-data-capture' },
      { id: 'h4', kind: 'concept', title: 'Failure modes & resilience patterns', detail: 'What actually happens when a dependency goes down.', href: '/concepts/failure-modes' },
      { id: 'h4b', kind: 'concept', title: 'Idempotency', detail: 'Making a retried request safe — comes up the moment money or a queue is involved.', href: '/concepts/idempotency' },
      { id: 'h4c', kind: 'concept', title: 'Observability: logs, metrics, traces', detail: 'How you\'d actually find the problem once one of these designs breaks in production.', href: '/concepts/observability' },
      { id: 'h4d', kind: 'concept', title: 'Gossip protocol', detail: 'How a leaderless cluster learns its own membership without a central coordinator.', href: '/concepts/gossip-protocol' },
      { id: 'h4e', kind: 'concept', title: 'Vector clocks', detail: 'Telling a causal write from a genuinely concurrent one, in a leaderless store.', href: '/concepts/vector-clocks' },
      { id: 'h4f', kind: 'concept', title: 'Merkle trees & anti-entropy', detail: 'Finding exactly where two replicas diverged, without comparing everything.', href: '/concepts/merkle-trees' },
      { id: 'h4g', kind: 'concept', title: 'Bloom filters', detail: 'A cheap "definitely not here" check that skips an expensive lookup.', href: '/concepts/bloom-filters' },
      { id: 'h4h', kind: 'concept', title: 'Geohashing', detail: 'Turning "find things near me" into a fast string-prefix lookup.', href: '/concepts/geohashing' },
      { id: 'h5', kind: 'problem', track: 'lld', slug: 'design-an-elevator-system', title: 'Design an Elevator System', detail: 'Concurrency and multi-unit coordination, in class form.', href: '/problems/lld/design-an-elevator-system' },
      { id: 'h6', kind: 'problem', track: 'hld', slug: 'design-a-payment-system', title: 'Design a Payment System', detail: 'Idempotency and a ledger model, where a bug means real money.', href: '/problems/hld/design-a-payment-system' },
      { id: 'h7', kind: 'problem', track: 'hld', slug: 'design-a-ride-sharing-service', title: 'Design a Ride-Sharing Service', detail: 'Geospatial indexing and real-time matching.', href: '/problems/hld/design-a-ride-sharing-service' },
      { id: 'h8', kind: 'problem', track: 'hld', slug: 'design-a-flash-sale', title: 'Design a Flash Sale System', detail: 'A thundering-herd write spike on a single hot item.', href: '/problems/hld/design-a-flash-sale' },
      { id: 'h9', kind: 'problem', track: 'hld', slug: 'design-a-multi-region-deployment', title: 'Design a Multi-Region Deployment', detail: 'Topology and replication trade-offs across regions.', href: '/problems/hld/design-a-multi-region-deployment' },
      { id: 'h10', kind: 'problem', track: 'hld', slug: 'design-a-multi-tenant-saas-platform', title: 'Design a Multi-Tenant SaaS Platform', detail: 'Isolation trade-offs when many customers share infrastructure.', href: '/problems/hld/design-a-multi-tenant-saas-platform' },
      { id: 'h11', kind: 'problem', track: 'hld', slug: 'design-a-distributed-cache', title: 'Design a Distributed Cache', detail: 'Building the cache infrastructure itself — consistent hashing and hot-key mitigation.', href: '/problems/hld/design-a-distributed-cache' },
      { id: 'h12', kind: 'problem', track: 'lld', slug: 'design-a-chess-game', title: 'Design a Chess Game', detail: 'The largest object graph in this set — six piece types, plus check/checkmate detection.', href: '/problems/lld/design-a-chess-game' },
      { id: 'h13', kind: 'problem', track: 'hld', slug: 'design-a-distributed-key-value-store', title: 'Design a Distributed Key-Value Store', detail: 'The Dynamo/Cassandra shape: quorum, vector clocks, and anti-entropy, for keeps.', href: '/problems/hld/design-a-distributed-key-value-store' },
      { id: 'h14', kind: 'problem', track: 'hld', slug: 'design-youtube', title: 'Design YouTube', detail: 'An asynchronous transcoding pipeline, adaptive bitrate, and a CDN for playback.', href: '/problems/hld/design-youtube' },
      { id: 'h15', kind: 'problem', track: 'hld', slug: 'design-nearby-friends', title: 'Design Nearby Friends', detail: 'The write-heavy, real-time cousin of a proximity search — persistent connections and scoped fan-out.', href: '/problems/hld/design-nearby-friends' },
      { id: 'h16', kind: 'problem', track: 'hld', slug: 'design-google-maps', title: 'Design Google Maps', detail: 'Offline graph precomputation for routing, plus tile-based map rendering.', href: '/problems/hld/design-google-maps' },
      { id: 'h17', kind: 'problem', track: 'hld', slug: 'design-a-distributed-message-queue', title: 'Design a Distributed Message Queue', detail: 'Build the Kafka shape yourself: partitions, replication, offsets.', href: '/problems/hld/design-a-distributed-message-queue' },
      { id: 'h18', kind: 'problem', track: 'hld', slug: 'design-ad-click-event-aggregation', title: 'Design Ad Click Event Aggregation', detail: 'Event-time windowing, late data, and exactly-once-ish counting for billing.', href: '/problems/hld/design-ad-click-event-aggregation' },
      { id: 'h19', kind: 'problem', track: 'hld', slug: 'design-a-distributed-email-service', title: 'Design a Distributed Email Service', detail: 'Gmail-shaped: object storage for bodies, a search index, async send.', href: '/problems/hld/design-a-distributed-email-service' },
      { id: 'h20', kind: 'problem', track: 'hld', slug: 'design-s3-like-object-storage', title: 'Design an S3-like Object Storage System', detail: 'The storage layer itself — chunking, erasure coding, and bit-rot detection.', href: '/problems/hld/design-s3-like-object-storage' },
      { id: 'h21', kind: 'problem', track: 'hld', slug: 'design-a-stock-exchange', title: 'Design a Stock Exchange (Matching Engine)', detail: 'The rare HLD problem where a single-threaded core beats horizontal scale.', href: '/problems/hld/design-a-stock-exchange' },
    ],
  },
  {
    id: 'mock',
    title: '8. Timed mock rounds',
    blurb: 'Everything above was untimed practice. Close the loop: run a full round with the clock actually on, then read the AI review as if it were the debrief after a real interview.',
    steps: [
      { id: 'mk1', kind: 'practice', title: 'One full 45-minute HLD round, no pausing to look things up', detail: 'Pick a problem you have not done yet and run the whole phase timer for real.', href: '/problems/hld/design-a-news-feed' },
      { id: 'mk2', kind: 'practice', title: 'One full 45-minute LLD round, same rules', detail: 'Same discipline, class-design flavor.', href: '/problems/lld/design-an-elevator-system' },
      { id: 'mk3', kind: 'practice', title: 'Read an AI review as if it were the actual debrief', detail: 'After scoring, copy the review prompt (or run a configured provider) and take the feedback seriously — including "what they\'d ask next."', href: '/' },
    ],
  },
];
