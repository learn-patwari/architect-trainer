# Architect Trainer

A local web app for system design interview prep — the HLD/LLD counterpart to [dsa-trainer](../dsa-trainer).

Most system design practice tools grade what you *said* (a transcribed verbal walkthrough) or hand your whole
diagram to an LLM with no offline tier. This one grades the diagram itself, deterministically, before an AI ever
sees it: your Excalidraw scene is parsed into a graph of labeled nodes and arrows, then checked against a rubric —
is there a load balancer in front of the app tier, is the cache actually on the read path, is there a single point
of failure, is a class diagram's abstraction actually implemented rather than just drawn — with no API key and no
network required. An AI review layer sits on top for judgment the rubric can't make (a technically-present-but-wrong
choice, an over-engineered design), reusing the same "copy the prompt for free, or configure a provider" pattern
as the DSA trainer. Alongside practice, there's the reading material a system design round assumes you already
have: a design-concepts glossary, an opinionated tools reference, and a capacity-estimation calculator.

Everything runs on your machine. No account, no telemetry.

---

## What's built

**HLD and LLD practice, on one shared pipeline.** Both tracks — statement, notes, phase timer, Excalidraw canvas,
deterministic rubric scoring, Elo rating, AI review — run through the exact same code (`server/trainer.ts`,
`shared/rubric/`, `shared/scene/`); only the content and the scene's role vocabulary (infrastructure vs.
class-design) differ, and that difference lives entirely in `shared/hld/` and `shared/lld/`.

- **HLD problems** (32, spanning Easy → Hard), picked from what Hello Interview, DesignGurus, ByteByteGo's System
  Design Interview course, and the other prep-source roundups consistently list as most-asked: Design a Pastebin
  and Design a Unique ID Generator (Easy — deliberately small, focused first problems), Design a URL Shortener,
  Design a Typeahead/Autocomplete System, Design a Notification System, Design a News Feed, Design a Chat System,
  Design a Flash Sale System, Design a Multi-Region Deployment, Design a Multi-Tenant SaaS Platform, Design a
  Ride-Sharing Service, Design a Ticket Booking System, Design a Web Crawler, Design a Payment System, Design a
  File Storage & Sync Service, Design a Distributed Cache, Design a Distributed Rate Limiter, Design Consistent
  Hashing, Design a Distributed Key-Value Store, Design YouTube, Design a Proximity Service, Design Nearby
  Friends, Design Google Maps, Design a Distributed Message Queue, Design a Metrics Monitoring and Alerting
  System, Design Ad Click Event Aggregation, Design a Hotel Reservation System, Design a Distributed Email
  Service, Design an S3-like Object Storage System, Design a Real-time Gaming Leaderboard, Design a Digital
  Wallet, Design a Stock Exchange (Matching Engine).
- **LLD problems** (16, spanning Easy → Hard), same research basis — the "everyday object" and "real-world system"
  questions that show up everywhere (parking lot, elevator, vending machine, LRU cache, tic-tac-toe, Splitwise,
  ATM, library systems are near-universal across every LLD list checked, and ByteByteGo's Object-Oriented Design
  Interview course rounds out the rest): Design Tic-Tac-Toe, Design a Library Management System, and Design an
  ATM Machine (Easy), Design a Parking Lot, Design a Rate Limiter, Design an In-Memory File System, Design a
  Movie Ticket Booking System, Design a Vending Machine, Design an LRU Cache, Design Splitwise, Design a Grocery
  Store System, Design a Blackjack Game, Design a Shipping Locker System, Design a Restaurant Management System
  (Medium), Design an Elevator System and Design a Chess Game (Hard). Class diagrams, not infrastructure diagrams
  — the rubric checks for an interface/abstraction that's actually implemented (not just drawn), no "god class"
  (one class touching a disproportionate share of the diagram's relationships), an enum for a fixed set of
  variants, typed relationships (extends/implements/has-a/uses, not bare arrows), and problem-specific concerns
  (the O(1) data-structure combo for an LRU cache, a debt-simplification algorithm for Splitwise, the
  fewest-notes cash-dispensing algorithm for an ATM, the Composite-pattern tree for a file system,
  check/checkmate detection for chess, thread-safety on an elevator's request queue, a pluggable discount-rule
  Strategy for a grocery checkout, the Ace's dual value pulled out cleanly in blackjack, a per-locker State
  machine for a shipping locker, and Observer-based order-status fan-out for a restaurant system).
- **Up to 3 hints per problem, requested one at a time.** Each hint is a bigger nudge than the last — a vague
  question, then a sharper one, then something close to (but shorter than) the reference architecture — never the
  full answer. Hints live in `shared/hld/` and `shared/lld/` alongside the rest of the answer-key content, so
  they're revealed by the server one at a time and never shipped to the browser whole; which hints you've already
  revealed persists across reloads, the same way saved scenes and notes do.

  *A scoping note, still standing:* flash sale, multi-region, and multi-tenant are built as **HLD** problems, not
  LLD — they're fundamentally about infrastructure topology and data-replication trade-offs, not class structure.
  Say so if you actually wanted LLD framings of these and I'll add them separately.
- **A study plan** (`/study-plan`) — not new content, a recommended order through everything else: foundational
  concepts, then the tools reference, then Easy problems in both tracks, then Medium, then Hard problems alongside
  the specialized concepts they need, then a reminder to run a couple of rounds with the timer on for real. The
  phase order follows what prep roadmaps (DesignGurus' 2026 roadmap, Hello Interview) converge on — foundations
  before building blocks, building blocks before practice, easy before hard. Problem steps show a live ✓ once
  you've made an attempt, pulled from the same dashboard state as the HLD/LLD tables.
- **A sequential phase timer at the top of the page**, not a free-click tab row: phases (requirements → estimation →
  API design → data model → high-level design → deep dive → trade-offs) unlock one at a time. **Review & continue**
  banks the current phase's time, logs it, and advances; you can still click back onto any phase you've already
  reached to review it or add more time, but you can't skip ahead of where you are.
- **The design itself is split into parts, one per phase, and combined at the end.** Requirements, estimation, API
  design, data model, and trade-offs each get their own written field — fill it in, click **Review & continue**, move
  to the next part. High-level design and deep dive switch that same workspace over to the Excalidraw canvas instead
  (it stays mounted underneath, so panning/zoom/undo history survive switching away and back). After you score your
  design, every phase's text is shown combined as one write-up, and it's sent to the AI reviewer the same way — a
  structured document assembled from the parts, not one big notes box.
- **Freeform notes as a one-click floating popup**, not a card you have to scroll past: a small button pinned to the
  corner of the screen opens and closes your running notes from anywhere in the flow.
- **Excalidraw** as the drawing surface (MIT-licensed; chosen over tldraw, whose SDK license now requires a
  watermark or a paid commercial license for production use, and over draw.io, whose embed mode fights the
  local-only posture with an iframe against `embed.diagrams.net`).
- **Deterministic rubric scoring**, 8 checks per problem, scored with no network call at all.
- **Hybrid rating**: the rubric percent feeds the same Elo math as the DSA trainer (1200 start, K=48 for the first
  3 rated attempts then 32), tracked **separately** for HLD and LLD; only the first attempt at a problem is rated.
- **AI review**, two ways: copy a prompt (plus a downloadable PNG of your diagram, since a copied prompt can't
  carry an image) into any chat for free, or configure a provider (OpenAI-compatible / Anthropic / local Ollama)
  and have the server send it — including the diagram as an image for vision-capable models.

**Reading material — no scoring, no server round trip, just open and read:**

- **Design concepts** (`/concepts`) — 88 topics across 11 categories, each its **own page** (`/concepts/:slug`), not
  just a card:
  - **Foundations** (7) — CAP theorem, consistency models, consensus (Paxos/Raft), leader election (Bully/Raft/ZAB),
    horizontal vs. vertical scaling, latency vs. throughput, concurrency vs. parallelism.
  - **Data & storage** (13) — partitioning/sharding, replication, caching strategies, CDC, hot partitions, SQL vs.
    NoSQL, block/object/file storage, database indexing, ACID & isolation levels, normalization vs. denormalization,
    Bloom filters, geohashing, Merkle trees & anti-entropy, vector clocks.
  - **Reliability** (9) — idempotency, back-pressure, rate limiting algorithms, failure modes and resilience
    patterns, quorum reads/writes (W + R > N), message delivery semantics, availability & high-availability
    patterns, disaster recovery (RTO & RPO), gossip protocol.
  - **Operations** (4) — observability (logs/metrics/traces), distributed tracing (spans & context propagation),
    consistent hashing & virtual nodes, load balancing algorithms.
  - **OOP & design patterns (LLD)** (10) — OOP fundamentals (encapsulation/abstraction/inheritance/polymorphism),
    SOLID principles, and the Strategy, Factory, Singleton, Observer, Adapter, Decorator, State, and Command
    patterns — each with a real standard-library example (Java's `Comparator`, `Calendar.getInstance()`,
    `BufferedInputStream`, Node's `EventEmitter`, TCP's own RFC 793 connection state machine, etc.) **and an actual
    code snippet**, not just a UML diagram.
  - **Networking & APIs** (6) — REST vs. RPC vs. GraphQL, DNS resolution, TCP vs. UDP, WebSockets/SSE/long polling,
    API Gateway/reverse proxy/forward proxy, and CDN & edge caching (PoPs, cache hit/miss, invalidation).
  - **Architecture patterns** (9) — microservices vs. monolith, event-driven architecture & event sourcing, CQRS,
    service discovery, distributed transactions & the Saga pattern, batch vs. stream processing, message queues
    (point-to-point vs. pub/sub), stateless vs. stateful services, serverless architecture.
  - **Security** (2) — authentication vs. authorization (OAuth 2.0 & JWTs), encryption in transit & at rest.
  - **Cloud (AWS)** (9) — the concrete AWS instance of several generic concepts above: VPC/subnets/security
    groups/NACLs, ALB vs. NLB vs. CLB, RDS vs. DynamoDB, SQS vs. SNS vs. EventBridge, IAM & least privilege,
    Route 53 routing policies, ECS vs. EKS vs. Fargate, S3 storage classes & lifecycle policies, CloudWatch & X-Ray.
  - **Cloud (GCP)** (9) — the same 9 services, GCP's way: VPC/firewall rules, global vs. regional load balancing,
    Cloud SQL vs. Firestore vs. Bigtable, Pub/Sub vs. Cloud Tasks, IAM & least privilege, Cloud DNS routing
    policies, GKE vs. Cloud Run, GCS storage classes & Object Lifecycle Management, Monitoring/Logging/Trace.
  - **Cloud (Azure)** (9) — and Azure's way: VNet/NSGs, Load Balancer vs. Application Gateway vs. Front Door,
    Azure SQL vs. Cosmos DB, Service Bus vs. Event Grid vs. Event Hubs, RBAC & managed identities, Traffic
    Manager routing methods, AKS vs. Container Apps vs. Container Instances, Blob storage tiers & lifecycle,
    Azure Monitor & Application Insights.

  Every page has the real explanation, a **concrete worked example naming a real system** (Discord's Cassandra→
  ScyllaDB migration, Shopify's "Majestic Monolith," Kafka's idempotent producer, Cassandra's quorum formula, GitHub's
  REST+GraphQL split, etc. — each fact checked against its own engineering blog or official docs, not invented), when to
  bring it up in an interview, common pitfalls, and **"Read more" links out to the actual GitHub repo, official
  docs, or paper** — not just prose asserting the concept.
- **Tools reference** (`/tools`) — 26 entries across databases, queues/streams, caches, and infra (Postgres
  through Flink), each with what it's good at, what it's bad at, its operational cost, and one concrete "use it
  when" example. Opinionated, not a feature matrix.
- **Capacity estimation** (`/estimate`) — the back-of-envelope math for the estimation phase: QPS (avg/peak),
  storage (with retention and replication), bandwidth, a rough server count, and an AWS cost ballpark (S3,
  egress, CloudFront, compute) — plus a 1M → 10M → 100M scaling table computed live from your inputs.

**Not built yet** (a further pass): spaced repetition, and a Settings UI for the AI provider (it's configured
today via `PUT /api/ai/config`, or by editing `data/ai.json` directly).

One deliberate simplification worth knowing: HLD's "is the datastore appropriate for the stated access pattern" is
scored as "did you name a specific technology, not just 'database'" — full semantic reasoning about read/write
ratios is left to the AI review layer, which does see your notes and can comment on the actual technology choice.

## Quick start

**Requirements:** Node.js 20 or newer (developed on 24).

**Windows, day to day:** double-click `start.cmd`. It installs dependencies on a first run, rebuilds the UI only
when something it's built from has changed, serves on http://localhost:5379 and opens your browser there.

**Any platform:**

```bash
npm install
npm start          # builds the UI, then serves everything on http://localhost:5379
```

**Working on the app itself:**

```bash
npm run dev        # API on 5379 + Vite on 5378, hot reload on both
```

Open http://localhost:5378; Vite proxies `/api` to the server.

## How the rubric works

`shared/scene/excalidraw-graph.ts` turns Excalidraw's `elements[]` into a generic graph: rectangles/ellipses/
diamonds become nodes, their bound (or overlapping) text becomes a label, and a keyword table infers a role from
that label — infrastructure roles (load balancer, app server, cache, queue, datastore, cdn, client) for HLD,
class-design roles (interface, abstract class, enum) for LLD. Arrows with both ends bound to a shape become
edges, and an arrow's own bound text becomes that edge's label (used for typed relationships in LLD).

`shared/rubric/checks.ts` provides reusable primitives over that graph: `hasRole`, `pathExists`,
`allNodesLabeled`, `redundancyEvidence`, `keywordAnywhere` for HLD-style infrastructure checks, plus
`implementorCount`, `hasDominantNode`, `nodesWithoutRoles`, `edgeLabelMatches` for LLD-style class-design checks.
Each problem in `shared/hld/` or `shared/lld/` composes these into its own `RubricSpec` — adding the next problem
in either track is content authoring against these primitives, not new graph-reasoning code.

The rubric, the reference architecture, and the check explanations live in `shared/` but are imported only by
`server/` — never by `web/src`. `tests/bundle-secrecy.test.ts` builds the client and greps the emitted JS to prove
none of that answer-key content is statically bundled, the same discipline the DSA trainer applies to its problem
bank. (The design-concepts and tools-reference content is *not* secret — it's imported directly by `web/src`,
same as the DSA trainer's own reference pages.)

## The timer

Seven phases, one pair of clocks per phase (wall + active, following the DSA trainer's `useTimer.ts` — see
`web/src/hld/usePhaseTimer.ts`). Switching phases banks time into the outgoing phase before the next one starts
running. After you score a design, the result shows each phase's actual share of the round against its
recommended share, flagging anything that ran well over budget.

## AI review

One prompt builder (`shared/ai-prompt.ts`), two delivery paths, mirroring the DSA trainer:

- **Copy the prompt** — free, no key. It bundles the requirements, your notes, the diagram as a structured text
  description, and the rubric's findings. Use **Download PNG** alongside it and paste both into the chat, since a
  copied prompt can't carry an image.
- **Configure a provider** — `PUT /api/ai/config` with `{ provider, baseUrl, model, apiKey, maxTokens }`
  (`openai`, `anthropic`, or `ollama`). The server then sends the prompt *and* a PNG of your diagram as a vision
  content block. The key is stored in `data/ai.json` (gitignored), never returned to the browser, and only ever
  sent to the base URL you configured.

## Your data

Everything lives in `data/` (gitignored): `progress.json` (ratings per track, attempts, saved scenes and notes,
phase times, for both HLD and LLD) and `ai.json` (your provider config, if you set one).

**Nothing you do is lost to a reload, a closed tab, or a server restart.** Beyond scenes, notes and hints, the
server also keeps which phase you were on, which phases you'd reviewed, the time banked per phase, your last
score result, and your last AI review — reopening a problem drops you back where you were, with the clock paused
(time spent away isn't work time) until you press Resume. Text you typed in the last moments before closing the
tab is flushed on the way out rather than waiting for the autosave debounce. Writes are atomic (temp file +
rename), so even a hard kill mid-save can't leave `progress.json` half-written.

**Security posture**, same as the DSA trainer: the server binds 127.0.0.1 only, rejects non-local `Host` headers,
and requires `application/json` on writes.

## Development

| Command | What it does |
|---|---|
| `npm run dev` | API (tsx watch) + Vite dev server |
| `npm start` | Build the UI and serve everything on 5379 |
| `npm test` | Vitest (the bundle-secrecy check auto-skips if `dist/web` hasn't been built yet) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run verify:bundle` | Builds the client, then runs only the bundle-secrecy check against it |

### Layout

```
shared/     types, Elo scoring, the AI review prompt builder, the combined problem registry (problems.ts)
            scene/      Excalidraw elements[] -> a generic node/edge graph (both HLD and LLD role vocabularies)
            rubric/     reusable graph checks + the runner (answer-key layer; server-only)
            hld/        curated HLD problems: statement, rubric, reference architecture
            lld/        curated LLD problems: same shape, class-design rubrics
            timer/      the seven interview phases and their recommended budget shares
            concepts/   the design-concepts glossary (not secret; imported by web/ directly)
            tools/      the tools reference (not secret; imported by web/ directly)
            study-plan/ the recommended study order, linking to problems/concepts/tools/estimate (not secret)
            estimate/   capacity-estimation formulas + ballpark AWS pricing (not secret)
server/     app.ts      Express API, local-only guard, generic /problems/:track/:slug routes
            trainer.ts  problem view, scoring, phase-time accounting, dashboard — track-generic
            ai.ts       provider adapters (OpenAI-compatible / Anthropic / Ollama)
            store.ts    JSON store with serialized, atomic writes
web/        React 19 + Vite: dashboard (both tracks), the problem page (shared by HLD/LLD),
            the concepts/tools/estimate pages
tests/      scene graph parsing (incl. LLD roles), the rubric engine (HLD + LLD problems and
            primitives), Elo math, phase-time accounting (both tracks), the AI prompt builder,
            the estimate calculator, a full HTTP round trip, and the bundle-secrecy check
```

### HTTP API

All routes are under `/api`, JSON in and out, localhost only. `:track` is `hld` or `lld`.

| Method | Route | Purpose |
|---|---|---|
| GET | `/state` | Track ratings and the HLD + LLD problem lists |
| GET | `/problems/:track/:slug` | Problem statement, phases, and your saved progress |
| PUT | `/problems/:track/:slug/scene` | Autosave the Excalidraw scene |
| PUT | `/problems/:track/:slug/notes` | Autosave your notes |
| PUT | `/problems/:track/:slug/phase-answer` | Autosave one phase's written field |
| PUT | `/problems/:track/:slug/phase-state` | Save the wizard's current phase + reviewed phases (and, on Restart, clear banked time) |
| POST | `/problems/:track/:slug/hint` | Reveal the next of the problem's 3 hints |
| POST | `/problems/:track/:slug/time` | Bank phase-time deltas |
| POST | `/problems/:track/:slug/score` | Run the rubric, update that track's rating on a first attempt |
| GET | `/problems/:track/:slug/ai-prompt` | The AI review prompt, text only |
| POST | `/problems/:track/:slug/ai-review` | The same prompt (plus an image, if captured), sent to your configured provider |
| GET/PUT/DELETE | `/ai/config` | Read, set, or clear the AI provider config |
| POST | `/reset` | Erase progress for both tracks (requires `{"confirm":"RESET"}`) |
