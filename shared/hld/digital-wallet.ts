import { allNodesLabeled, hasRole, keywordAnywhere, pathExists, redundancyEvidence } from '../rubric/checks.ts';
import type { RubricSpec } from '../rubric/types.ts';
import type { DesignProblem } from '../types.ts';

/**
 * The ledger problem: the crux is double-entry bookkeeping and ACID
 * transactions over balance transfers, distinct from Payment System (which
 * is about processing external card/bank transactions and retries against
 * a third-party processor) — this is about the internal balance itself
 * never being wrong.
 */

const DOUBLE_ENTRY_KEYWORDS = ['double-entry', 'double entry', 'debit and credit', 'ledger entry'];
const ACID_KEYWORDS = ['acid transaction', 'atomic transaction', 'single transaction'];
const IDEMPOTENCY_KEYWORDS = ['idempoten', 'idempotency key'];
const IMMUTABLE_LEDGER_KEYWORDS = ['immutable', 'append-only ledger', 'never updated in place'];
const RECONCILIATION_KEYWORDS = ['reconcil', 'balance check', 'audit'];
const NEGATIVE_BALANCE_KEYWORDS = ['negative balance', 'sufficient funds', 'balance check'];

const DIGITAL_WALLET_RUBRIC: RubricSpec = {
  id: 'design-a-digital-wallet',
  title: 'Design a Digital Wallet — rubric',
  checks: [
    {
      id: 'double-entry-ledger',
      label: 'Balances are modeled as double-entry ledger entries, not a single mutable balance field',
      max: 4,
      run: (g) =>
        keywordAnywhere(g, DOUBLE_ENTRY_KEYWORDS)
          ? { points: 4, verdict: 'pass', detail: 'Double-entry ledger modeling is named.' }
          : {
              points: 0,
              verdict: 'fail',
              detail: 'A single mutable "balance" column loses the history of how it got there and is easy to corrupt — name double-entry bookkeeping (every transfer is a debit on one account and a matching credit on another) as the actual data model.',
            },
    },
    {
      id: 'immutable-ledger',
      label: 'Ledger entries are immutable/append-only',
      max: 3,
      run: (g) =>
        keywordAnywhere(g, IMMUTABLE_LEDGER_KEYWORDS)
          ? { points: 3, verdict: 'pass', detail: 'An immutable, append-only ledger is named.' }
          : { points: 0, verdict: 'fail', detail: 'Say that ledger entries are never updated or deleted, only appended — a correction is a new, offsetting entry, so the full history is always reconstructable and auditable.' },
    },
    {
      id: 'atomic-transfer',
      label: 'A transfer\'s debit and credit commit atomically',
      max: 3,
      run: (g) =>
        keywordAnywhere(g, ACID_KEYWORDS)
          ? { points: 3, verdict: 'pass', detail: 'Atomic commit of both entries is named.' }
          : {
              points: 0,
              verdict: 'fail',
              detail: 'The debit and its matching credit must both succeed or both fail together — name that this is a single ACID transaction, not two separate writes that could partially fail.',
            },
    },
    {
      id: 'idempotent-transfer',
      label: 'The transfer request is idempotent',
      max: 3,
      run: (g) =>
        keywordAnywhere(g, IDEMPOTENCY_KEYWORDS)
          ? { points: 3, verdict: 'pass', detail: 'Idempotency is named.' }
          : { points: 0, verdict: 'fail', detail: 'A retried transfer request (a client timeout, a double-tap) must not move money twice — name an idempotency key on the request.' },
    },
    {
      id: 'balance-check',
      label: 'Sufficient-funds checking is atomic with the debit',
      max: 2,
      run: (g) =>
        keywordAnywhere(g, NEGATIVE_BALANCE_KEYWORDS)
          ? { points: 2, verdict: 'pass', detail: 'Atomic balance checking is named.' }
          : {
              points: 0,
              verdict: 'fail',
              detail: 'A check-then-debit that isn\'t atomic lets two concurrent transfers both see sufficient funds and both proceed, overdrawing the account — name that the check and the debit happen inside the same transaction.',
            },
    },
    {
      id: 'reconciliation-named',
      label: 'A reconciliation/audit process is named',
      max: 2,
      run: (g) =>
        keywordAnywhere(g, RECONCILIATION_KEYWORDS)
          ? { points: 2, verdict: 'pass', detail: 'Reconciliation is named.' }
          : { points: 0, verdict: 'fail', detail: 'Name a periodic process that verifies every account\'s computed balance (sum of its ledger entries) matches its cached/displayed balance — catching bugs before they compound.' },
    },
    {
      id: 'lb-in-front',
      label: 'A load balancer sits in front of the app tier',
      max: 1,
      run: (g) => (pathExists(g, 'client', 'loadBalancer') ? { points: 1, verdict: 'pass', detail: 'A load balancer is present.' } : { points: 0, verdict: 'fail', detail: 'Route the client through a load balancer to the app tier.' }),
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
      id: 'datastore-present',
      label: 'A durable, ACID-capable datastore holds the ledger',
      max: 1,
      run: (g) =>
        hasRole(g, 'datastore')
          ? { points: 1, verdict: 'pass', detail: 'A datastore is present.' }
          : { points: 0, verdict: 'fail', detail: 'Name the actual datastore holding the ledger.' },
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

const STATEMENT = `Design a digital wallet: users hold a balance and can transfer money to other users within the platform. Unlike a payment system, there's no external card network involved — this is the internal ledger itself.

Functional requirements:
- transfer(fromUser, toUser, amount) moves money between two internal wallet balances.
- getBalance(userId) always reflects every committed transfer exactly, with no drift over time.
- A user can never end up with a negative balance from a normal transfer (no overdraft).

Non-functional requirements / scale:
- Every transfer must be auditable after the fact — you can reconstruct exactly how any balance arrived at its current value.
- High concurrency: many transfers touching the same popular account (e.g. a merchant receiving many payments) at once.
- The system is money — a bug here is a financial-correctness bug, not just a UX bug.`;

const REFERENCE_APPROACH = `Balances are never stored as a single mutable number that gets incremented/decremented in place — they're derived from a double-entry ledger: every transfer creates two entries, a debit on the sender's account and a matching credit on the receiver's, and an account's balance is the sum of its own ledger entries. Ledger entries themselves are immutable and append-only — never updated or deleted after the fact — so a correction (reversing an erroneous transfer) is a new, offsetting entry rather than editing history, which is what makes the ledger fully auditable and reconstructable at any point in time. The debit and its matching credit commit as a single ACID transaction: both succeed or both fail together, never leaving one side applied without the other. Checking sufficient funds happens INSIDE that same transaction as the debit (not as a separate prior read), because a check-then-debit split across two operations lets two concurrent transfers both see a sufficient balance and both proceed, overdrawing the account — the classic race this design must close. The transfer request itself carries an idempotency key, so a client retry after a timeout doesn't move money a second time. A separate, periodic reconciliation process independently verifies that every account's ledger-derived balance matches whatever cached/materialized balance is shown to the user, specifically to catch any drift or bug before it compounds silently across millions of accounts. The datastore holding the ledger needs real ACID transaction support (a relational database, or a distributed database with equivalent transactional guarantees) — this is not a place to reach for an eventually-consistent store.`;

export const DIGITAL_WALLET: DesignProblem = {
  slug: 'design-a-digital-wallet',
  track: 'hld',
  title: 'Design a Digital Wallet',
  difficulty: 'Medium',
  statement: STATEMENT,
  rubric: DIGITAL_WALLET_RUBRIC,
  referenceApproach: REFERENCE_APPROACH,
  hints: [
    'If "balance" is just a number you increment and decrement, how would you ever reconstruct exactly how an account arrived at that value, or catch a bug that silently drifted it?',
    'Two concurrent transfers both check "does this account have enough funds" before either one debits it. What has to be true about that check for the account to never go negative?',
    'Model balances as double-entry, immutable ledger entries (a debit and a matching credit per transfer), commit both inside one ACID transaction with the balance check included, and make the transfer request idempotent.',
  ],
};
