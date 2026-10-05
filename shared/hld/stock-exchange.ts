import { allNodesLabeled, hasRole, keywordAnywhere, redundancyEvidence } from '../rubric/checks.ts';
import type { RubricSpec } from '../rubric/types.ts';
import type { DesignProblem } from '../types.ts';

/**
 * The order-matching-engine problem: the crux is a single-threaded,
 * in-memory matching core per instrument (correctness and ordering matter
 * more than horizontal scale here) plus a durable, replayable write-ahead
 * log — the opposite instinct from most HLD problems, which reach for
 * horizontal scaling and eventual consistency by default.
 */

const SINGLE_THREADED_KEYWORDS = ['single-threaded', 'single threaded', 'one thread per instrument'];
const ORDER_BOOK_KEYWORDS = ['order book', 'limit order book', 'bid', 'ask'];
const MATCHING_KEYWORDS = ['price-time priority', 'fifo matching', 'matching engine'];
const WAL_KEYWORDS = ['write-ahead log', 'wal', 'event sourcing', 'replay'];
const SHARD_BY_INSTRUMENT_KEYWORDS = ['shard by instrument', 'partition by symbol', 'per-instrument'];
const MARKET_DATA_KEYWORDS = ['market data', 'ticker', 'trade feed'];
const IDEMPOTENCY_KEYWORDS = ['idempoten', 'sequence number'];

const STOCK_EXCHANGE_RUBRIC: RubricSpec = {
  id: 'design-a-stock-exchange',
  title: 'Design a Stock Exchange (Matching Engine) — rubric',
  checks: [
    {
      id: 'order-book-named',
      label: 'A limit order book (bids and asks) is named',
      max: 3,
      run: (g) =>
        keywordAnywhere(g, ORDER_BOOK_KEYWORDS)
          ? { points: 3, verdict: 'pass', detail: 'An order book is named.' }
          : { points: 0, verdict: 'fail', detail: 'Name the actual data structure at the core of this system — a limit order book, holding resting buy (bid) and sell (ask) orders per instrument.' },
    },
    {
      id: 'matching-rule-named',
      label: 'A deterministic matching rule (price-time priority) is named',
      max: 3,
      run: (g) =>
        keywordAnywhere(g, MATCHING_KEYWORDS)
          ? { points: 3, verdict: 'pass', detail: 'A matching rule is named.' }
          : { points: 0, verdict: 'fail', detail: 'Say how two matchable orders are actually paired — price-time priority (best price first, and first-in among equal prices) is the industry-standard, and fairness depends on it being explicit and deterministic.' },
    },
    {
      id: 'single-writer-per-instrument',
      label: 'Each instrument\'s order book is owned by a single writer (no concurrent mutation)',
      max: 4,
      run: (g) =>
        keywordAnywhere(g, SINGLE_THREADED_KEYWORDS)
          ? { points: 4, verdict: 'pass', detail: 'Single-writer-per-instrument is named.' }
          : {
              points: 0,
              verdict: 'fail',
              detail: 'Two threads concurrently mutating one instrument\'s order book can violate price-time priority or double-match an order — name that each instrument\'s book is owned by exactly one writer (a single-threaded matching core per instrument), sidestepping locking entirely.',
            },
    },
    {
      id: 'horizontal-scale-via-sharding',
      label: 'Scale comes from sharding by instrument, not from parallelizing one book',
      max: 3,
      run: (g) =>
        keywordAnywhere(g, SHARD_BY_INSTRUMENT_KEYWORDS)
          ? { points: 3, verdict: 'pass', detail: 'Sharding by instrument is named.' }
          : {
              points: 0,
              verdict: 'fail',
              detail: 'You can\'t parallelize matching within one instrument\'s book without breaking price-time priority — name that horizontal scale instead comes from running many single-threaded matching cores, one (or a few) per instrument/symbol.',
            },
    },
    {
      id: 'durable-order-log',
      label: 'Every order/trade is durably logged before being acknowledged',
      max: 3,
      run: (g) =>
        keywordAnywhere(g, WAL_KEYWORDS)
          ? { points: 3, verdict: 'pass', detail: 'A durable, replayable log is named.' }
          : {
              points: 0,
              verdict: 'fail',
              detail: 'An in-memory-only order book loses every resting order on a crash — name a write-ahead/event log that persists every order and trade before acknowledging it, so a crashed matching core can rebuild its exact book state by replaying the log.',
            },
    },
    {
      id: 'idempotent-order-submission',
      label: 'Order submission is idempotent (dedup on retry)',
      max: 2,
      run: (g) =>
        keywordAnywhere(g, IDEMPOTENCY_KEYWORDS)
          ? { points: 2, verdict: 'pass', detail: 'Idempotent order submission is named.' }
          : { points: 0, verdict: 'fail', detail: 'A retried order-submission request must not place the same order twice — name a client-supplied sequence number/idempotency key the matching core dedupes on.' },
    },
    {
      id: 'market-data-fanout',
      label: 'Executed trades fan out to a market-data feed, separate from the matching path',
      max: 2,
      run: (g) =>
        keywordAnywhere(g, MARKET_DATA_KEYWORDS)
          ? { points: 2, verdict: 'pass', detail: 'A market-data feed is named.' }
          : { points: 0, verdict: 'fail', detail: 'Say how the rest of the world (tickers, charts, other traders) learns a trade happened — a market-data feed the matching core publishes to, decoupled from the matching path itself.' },
    },
    {
      id: 'nodes-redundant',
      label: 'More than one matching-core instance is shown (one per instrument shard)',
      max: 1,
      run: (g) =>
        redundancyEvidence(g, 'appServer') || hasRole(g, 'queue')
          ? { points: 1, verdict: 'pass', detail: 'Multiple matching instances are shown.' }
          : { points: 0, verdict: 'fail', detail: 'Show more than one matching-core instance — each handling its own shard of instruments.' },
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

const STATEMENT = `Design the core matching engine of a stock exchange: traders submit buy/sell orders for a given instrument, and the system matches compatible orders and executes trades, fairly and deterministically.

Functional requirements:
- submitOrder(instrument, side, price, quantity) either matches immediately against a resting order, or rests in the order book waiting for a match.
- Matching is fair and deterministic: given the same sequence of orders, the same trades happen in the same order, every time.
- Cancelling a resting order removes it from consideration for future matches.

Non-functional requirements / scale:
- Extremely low, predictable latency per order (microseconds to low milliseconds) — this is the opposite of "eventually consistent is fine."
- Correctness and fairness (price-time priority) matter more than raw horizontal scalability of any single instrument's book.
- A crash must not lose or corrupt the order book — every order and trade must be recoverable.`;

const REFERENCE_APPROACH = `The core data structure is a limit order book per instrument: two sorted collections of resting orders, bids (buys, sorted best-price-first, i.e. highest first) and asks (sells, sorted lowest-price-first), each level further ordered by arrival time. An incoming order matches against the best resting order(s) on the opposite side under price-time priority — best price wins, and among equal prices, first-in-time wins — a rule that has to be explicit and deterministic, since matching fairness is the entire point of the system. The critical, counter-intuitive design decision: each instrument's order book is owned by exactly one single-threaded matching core, not protected by a lock shared across threads — a lock-protected book under concurrent access can still reorder or interleave matches in ways that violate price-time priority, while a single writer per instrument sidesteps the problem entirely by construction, at the cost of that one instrument's throughput being capped by one core's speed. Horizontal scale therefore doesn't come from parallelizing within one instrument's book (which isn't safely possible without breaking the ordering guarantee) — it comes from running many such single-threaded cores in parallel, one (or a small number) per instrument/symbol, since different instruments' order books have no interaction with each other. Every incoming order and every resulting trade is appended to a durable, replayable write-ahead log before being acknowledged, so a crashed matching core can rebuild its exact in-memory order-book state by replaying the log from the last snapshot — an in-memory-only book would silently lose every resting order on a crash. Order submission carries a client-supplied sequence number the matching core dedupes on, so a retried submission (a client timeout) doesn't place a duplicate order. Once a trade executes, it's published to a separate market-data feed (for tickers, charts, and other traders' order-routing decisions) asynchronously — deliberately decoupled from the matching path itself, so market-data fan-out latency or load can never slow down or block order matching.`;

export const STOCK_EXCHANGE: DesignProblem = {
  slug: 'design-a-stock-exchange',
  track: 'hld',
  title: 'Design a Stock Exchange (Matching Engine)',
  difficulty: 'Hard',
  statement: STATEMENT,
  rubric: STOCK_EXCHANGE_RUBRIC,
  referenceApproach: REFERENCE_APPROACH,
  hints: [
    'If two threads can concurrently mutate the same instrument\'s order book, even behind a lock, what real fairness/ordering guarantee becomes hard to keep? What\'s the simpler alternative?',
    'If matching one instrument\'s book can\'t safely be parallelized, where does horizontal scale for the WHOLE exchange (thousands of instruments) actually come from?',
    'Give each instrument its own single-threaded matching core over a price-time-priority order book, durably log every order/trade to a replayable write-ahead log, scale by sharding across instruments, and publish trades to a market-data feed decoupled from the matching path.',
  ],
};
