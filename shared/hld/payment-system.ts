import { allNodesLabeled, hasRole, keywordAnywhere, redundancyEvidence } from '../rubric/checks.ts';
import type { RubricSpec } from '../rubric/types.ts';
import type { DesignProblem } from '../types.ts';

/**
 * The problem where idempotency (already a design concept elsewhere in this
 * app) and a ledger model are the actual crux, not throughput or scale.
 */

const IDEMPOTENCY_KEYWORDS = ['idempotency key', 'idempotent', 'dedupe key'];
const LEDGER_KEYWORDS = ['ledger', 'double-entry', 'double entry', 'debit and credit'];

const PAYMENT_SYSTEM_RUBRIC: RubricSpec = {
  id: 'design-a-payment-system',
  title: 'Design a Payment System — rubric',
  checks: [
    {
      id: 'load-balancer',
      label: 'Load balancer in front of the app tier',
      max: 3,
      run: (g) =>
        hasRole(g, 'loadBalancer')
          ? { points: 3, verdict: 'pass', detail: 'A load balancer is present.' }
          : { points: 0, verdict: 'fail', detail: 'No load balancer drawn.' },
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
      id: 'idempotency-key',
      label: 'An idempotency key on the payment write path is named',
      max: 3,
      run: (g) =>
        keywordAnywhere(g, IDEMPOTENCY_KEYWORDS)
          ? { points: 3, verdict: 'pass', detail: 'An idempotency-key mechanism is named.' }
          : {
              points: 0,
              verdict: 'fail',
              detail: 'Name how a client retry after a timeout is prevented from charging twice (an idempotency key the server dedupes on) — this is the single most important correctness property in a payment API.',
            },
    },
    {
      id: 'ledger-model',
      label: 'A double-entry ledger (not a mutable balance) is named',
      max: 3,
      run: (g) =>
        keywordAnywhere(g, LEDGER_KEYWORDS)
          ? { points: 3, verdict: 'pass', detail: 'A ledger model is named.' }
          : {
              points: 0,
              verdict: 'fail',
              detail: 'Name a ledger (double-entry: every transaction debits one account and credits another, so the sum is always auditable) rather than a single mutable `balance` column, which can\'t be reconciled after the fact.',
            },
    },
    {
      id: 'async-webhook-queue',
      label: 'A queue handles async processor webhooks/reconciliation',
      max: 2,
      run: (g) =>
        hasRole(g, 'queue')
          ? { points: 2, verdict: 'pass', detail: 'A queue handles async payment events.' }
          : { points: 0, verdict: 'fail', detail: 'No queue drawn for async webhook/reconciliation processing — handling a payment processor\'s async confirmation inline on the request path risks losing it if a worker is briefly down.' },
    },
    {
      id: 'datastore-present',
      label: 'A datastore for the ledger/transactions is present',
      max: 2,
      run: (g) =>
        hasRole(g, 'datastore')
          ? { points: 2, verdict: 'pass', detail: 'A datastore is present.' }
          : { points: 0, verdict: 'fail', detail: 'No datastore drawn.' },
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

const STATEMENT = `Design a payment processing system that lets a user pay for an order: charge a payment method, record the transaction, and handle client retries safely without ever double-charging.

Functional requirements:
- Submit a payment for an order and get a success/failure/pending result.
- View transaction history.
- Support refunds.

Non-functional requirements / scale:
- Money must never be lost, double-counted, or unaccounted for.
- The system integrates with an external payment processor, which can be slow or fail transiently.
- Every transaction must be fully auditable after the fact.`;

const REFERENCE_APPROACH = `Clients reach the app tier through a load balancer. Every payment request carries a client-generated idempotency key; the server checks whether it has already processed that key before doing any work, so a client retry after a timeout returns the original result instead of charging again — this is the load-bearing correctness property of the whole system. The system of record for money movement is a ledger using double-entry accounting: every transaction debits one account and credits another, so the sum across all accounts is always zero and any discrepancy is immediately detectable — a single mutable \`balance\` column can't offer that guarantee. The ledger lives in a strongly consistent datastore. Calls to the external payment processor happen synchronously from the app tier for the initial charge, but the processor's asynchronous webhook confirmations are handled through a queue, since losing or blocking on a webhook shouldn't be possible just because a worker is briefly unavailable. Redundancy across the load balancer, app tier, and datastore. The two things interviewers listen for: (1) an explicit idempotency-key strategy, and (2) a ledger model rather than a single balance field.`;

export const PAYMENT_SYSTEM: DesignProblem = {
  slug: 'design-a-payment-system',
  track: 'hld',
  title: 'Design a Payment System',
  difficulty: 'Hard',
  statement: STATEMENT,
  rubric: PAYMENT_SYSTEM_RUBRIC,
  referenceApproach: REFERENCE_APPROACH,
  hints: [
    'A client\'s request times out and it retries the charge. What stops that retry from charging the card a second time?',
    'If you just store a single `balance` number per account, how would you ever audit or explain a discrepancy after the fact?',
    'Require an idempotency key on every charge request that the server dedupes on, and model money movement as a double-entry ledger (every transaction debits one account and credits another), not a mutable balance column.',
  ],
};
