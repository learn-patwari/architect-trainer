import { allNodesLabeled, edgeLabelMatches, hasDominantNode, hasRole, implementorCount, keywordAnywhere } from '../rubric/checks.ts';
import type { RubricSpec } from '../rubric/types.ts';
import type { DesignProblem } from '../types.ts';

/**
 * An Easy-tier LLD problem and the classic first introduction to the State pattern:
 * an ATM's behavior (what a button press does) depends entirely on which state it's
 * in (idle, card inserted, PIN entered), which is a more concrete on-ramp to
 * "interface + concrete implementors" than a more abstract strategy problem.
 */

const RELATIONSHIP_KEYWORDS = ['extends', 'implements', 'has-a', 'has a', 'uses', 'aggregates', 'composes'];

const ATM_RUBRIC: RubricSpec = {
  id: 'design-an-atm-machine',
  title: 'Design an ATM Machine — rubric',
  checks: [
    {
      id: 'has-abstraction',
      label: 'An interface or abstract class is present (e.g. ATM state or transaction type)',
      max: 3,
      run: (g) =>
        hasRole(g, 'interface') || hasRole(g, 'abstractClass')
          ? { points: 3, verdict: 'pass', detail: 'An interface or abstract class is present.' }
          : { points: 0, verdict: 'fail', detail: 'Name at least one abstraction — e.g. an ATMState interface (Idle, HasCard, HasPin) or a Transaction interface (Withdraw, Deposit, CheckBalance).' },
    },
    {
      id: 'polymorphism-used',
      label: 'At least two concrete classes implement/extend an abstraction',
      max: 3,
      run: (g) => {
        const n = implementorCount(g, ['interface', 'abstractClass']);
        if (n >= 2) return { points: 3, verdict: 'pass', detail: `${n} concrete classes implement or extend an abstraction.` };
        if (n === 1) return { points: 1, verdict: 'partial', detail: 'Only one class implements the abstraction — polymorphism needs at least a second to be worth having.' };
        return { points: 0, verdict: 'fail', detail: 'No concrete class is wired to (implements/extends) an interface or abstract class.' };
      },
    },
    {
      id: 'no-god-class',
      label: 'No single class does everything (a "god class")',
      max: 3,
      run: (g) =>
        hasDominantNode(g)
          ? { points: 0, verdict: 'fail', detail: 'One class accounts for a disproportionate share of all the relationships in this diagram — often an ATM class that also validates PINs, dispenses cash, and tracks state itself. Delegate to collaborators.' }
          : { points: 3, verdict: 'pass', detail: 'Responsibilities look reasonably distributed across classes.' },
    },
    {
      id: 'enum-named',
      label: 'An enum is used for a fixed set of variants (e.g. card or transaction status)',
      max: 2,
      run: (g) =>
        hasRole(g, 'enumType')
          ? { points: 2, verdict: 'pass', detail: 'An enum is named for a fixed set of variants.' }
          : { points: 0, verdict: 'fail', detail: 'A transaction\'s outcome (approved, declined, insufficient funds) is a small fixed set — model it as an enum.' },
    },
    {
      id: 'typed-relationships',
      label: 'Relationships between classes are typed, not generic arrows',
      max: 2,
      run: (g) =>
        edgeLabelMatches(g, RELATIONSHIP_KEYWORDS)
          ? { points: 2, verdict: 'pass', detail: 'At least one relationship is explicitly typed.' }
          : { points: 0, verdict: 'fail', detail: 'Label at least one arrow with what kind of relationship it is (extends, implements, has-a, uses).' },
    },
    {
      id: 'cash-dispensing-named',
      label: 'The cash-dispensing algorithm (which notes to give) is named',
      max: 2,
      run: (g) =>
        keywordAnywhere(g, ['minimum number of notes', 'denomination', 'note dispensing', 'greedy', 'bill dispensing'])
          ? { points: 2, verdict: 'pass', detail: 'A cash-dispensing algorithm is named.' }
          : {
              points: 0,
              verdict: 'fail',
              detail: 'Dispensing a withdrawal amount using the fewest notes across available denominations is the actual algorithmic core of this problem — name the approach (typically a greedy pick from largest to smallest denomination).',
            },
    },
    {
      id: 'orchestrator-present',
      label: 'A top-level ATM class coordinates the rest',
      max: 2,
      run: (g) =>
        keywordAnywhere(g, ['atm', 'machine'])
          ? { points: 2, verdict: 'pass', detail: 'A top-level coordinating class is present.' }
          : { points: 0, verdict: 'fail', detail: 'Model the ATM itself as a class that holds the current state and the cash inventory, and delegates each button press to the current state.' },
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

const STATEMENT = `Design the class structure for an ATM machine.

Functional requirements:
- Insert a card, enter a PIN, and be authenticated against an account.
- Withdraw cash (dispensing the fewest physical notes), deposit cash, and check balance.
- Reject a withdrawal that exceeds the account balance or the machine's remaining cash.
- The ATM's available operations change depending on where you are in the flow (no card vs. card inserted vs. authenticated).

Design expectations:
- Use an interface or abstract class somewhere a real interviewer would expect polymorphism (the ATM's state machine, or the set of transaction types).
- Name the classes and the relationships between them (extends / implements / has-a / uses) — draw it as a class diagram, not an infrastructure diagram.`;

const REFERENCE_APPROACH = `This is the canonical State-pattern problem: define an ATMState interface with insertCard()/enterPin()/ejectCard() methods, and concrete states IdleState, HasCardState, and AuthenticatedState — the ATM class holds a reference to its \`currentState\` and delegates every button press to it, transitioning to the next state as a side effect. Separately, model each operation as its own Transaction (an interface or abstract class) with WithdrawTransaction, DepositTransaction, and CheckBalanceTransaction implementations, each validating against the Account before executing — this keeps "what can go wrong with a withdrawal" (insufficient account balance, insufficient machine cash) out of the state machine entirely. The CashDispenser is its own class holding a count per denomination, exposing dispense(amount) that greedily picks the largest denomination that still fits, working down — the one genuinely algorithmic piece of this problem, and worth being explicit about rather than hand-waving "it gives you the money." A TransactionStatus enum (APPROVED / DECLINED_INSUFFICIENT_FUNDS / DECLINED_INSUFFICIENT_CASH) gives every transaction a small, well-defined outcome set instead of ad hoc booleans or strings. The god-class failure mode here is an ATM class that also validates PINs, checks balances, and counts notes itself — each belongs to State, Account, and CashDispenser respectively.`;

export const ATM_MACHINE: DesignProblem = {
  slug: 'design-an-atm-machine',
  track: 'lld',
  title: 'Design an ATM Machine',
  difficulty: 'Easy',
  statement: STATEMENT,
  rubric: ATM_RUBRIC,
  referenceApproach: REFERENCE_APPROACH,
  hints: [
    'What the ATM lets you do next depends entirely on whether a card is inserted and whether a PIN has been entered. What pattern is that?',
    'Giving back $70 from a drawer of $50s, $20s, $10s, and $5s — what\'s the actual algorithm for deciding which notes to dispense?',
    'Model ATMState as an interface with Idle/HasCard/Authenticated implementations that the ATM delegates every button press to, and give the CashDispenser a greedy largest-denomination-first algorithm.',
  ],
};
