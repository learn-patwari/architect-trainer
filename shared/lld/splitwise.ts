import { allNodesLabeled, edgeLabelMatches, hasDominantNode, hasRole, implementorCount, keywordAnywhere } from '../rubric/checks.ts';
import type { RubricSpec } from '../rubric/types.ts';
import type { DesignProblem } from '../types.ts';

/**
 * A "real-world system" LLD problem, distinct in flavor from the domain-
 * modeling (parking lot) and algorithm-library (rate limiter) problems: the
 * crux is a swappable Strategy for splitting an expense, plus a balance
 * model kept separate from raw history.
 */

const RELATIONSHIP_KEYWORDS = ['extends', 'implements', 'has-a', 'has a', 'uses', 'aggregates', 'composes'];

const SPLITWISE_RUBRIC: RubricSpec = {
  id: 'design-splitwise',
  title: 'Design Splitwise — rubric',
  checks: [
    {
      id: 'has-abstraction',
      label: 'A SplitStrategy interface/abstract class is present',
      max: 3,
      run: (g) =>
        hasRole(g, 'interface') || hasRole(g, 'abstractClass')
          ? { points: 3, verdict: 'pass', detail: 'A split-strategy abstraction is present.' }
          : { points: 0, verdict: 'fail', detail: 'Name a SplitStrategy interface so recording an expense doesn\'t hardcode one splitting rule.' },
    },
    {
      id: 'polymorphism-used',
      label: 'At least two split strategies implement the abstraction',
      max: 3,
      run: (g) => {
        const n = implementorCount(g, ['interface', 'abstractClass']);
        if (n >= 2) return { points: 3, verdict: 'pass', detail: `${n} concrete split strategies implement the abstraction.` };
        if (n === 1) return { points: 1, verdict: 'partial', detail: 'Only one split strategy implements the abstraction — the prompt asks for equal, exact, and percentage splits.' };
        return { points: 0, verdict: 'fail', detail: 'No concrete split strategy is wired to (implements/extends) the abstraction.' };
      },
    },
    {
      id: 'no-god-class',
      label: 'No single class does everything (a "god class")',
      max: 3,
      run: (g) =>
        hasDominantNode(g)
          ? { points: 0, verdict: 'fail', detail: 'One class accounts for a disproportionate share of the relationships here — an Expense or Group class that also computes splits and tracks balances directly is the shape this checks for.' }
          : { points: 3, verdict: 'pass', detail: 'Responsibilities look reasonably distributed across classes.' },
    },
    {
      id: 'enum-named',
      label: 'An enum models the split type or expense category',
      max: 2,
      run: (g) =>
        hasRole(g, 'enumType')
          ? { points: 2, verdict: 'pass', detail: 'An enum is named.' }
          : { points: 0, verdict: 'fail', detail: 'Split type (equal/exact/percentage) is a small fixed set — model it as an enum.' },
    },
    {
      id: 'typed-relationships',
      label: 'Relationships between classes are typed, not generic arrows',
      max: 2,
      run: (g) =>
        edgeLabelMatches(g, RELATIONSHIP_KEYWORDS)
          ? { points: 2, verdict: 'pass', detail: 'At least one relationship is explicitly typed.' }
          : { points: 0, verdict: 'fail', detail: 'Label at least one arrow with what kind of relationship it is (implements, has-a, uses).' },
    },
    {
      id: 'balance-tracking',
      label: 'A Balance/Ledger concept, distinct from raw expense history, is named',
      max: 3,
      run: (g) =>
        keywordAnywhere(g, ['balance', 'ledger', 'net amount', 'owes'])
          ? { points: 3, verdict: 'pass', detail: 'Balance/ledger tracking is named.' }
          : {
              points: 0,
              verdict: 'fail',
              detail: 'Name what tracks "who owes whom right now" (a Balance or Ledger) — that\'s a different, derived concept from the raw list of expenses, and re-deriving it from history on every query doesn\'t scale.',
            },
    },
    {
      id: 'debt-simplification',
      label: 'Debt simplification is named as its own concern',
      max: 2,
      run: (g) =>
        keywordAnywhere(g, ['debt simplification', 'simplify debts', 'minimize transactions', 'graph-based settlement'])
          ? { points: 2, verdict: 'pass', detail: 'Debt simplification is named.' }
          : { points: 0, verdict: 'fail', detail: 'Name the algorithm that reduces a tangle of pairwise debts down to the minimum number of settling transactions — this is the specific hard part of the "simplified" requirement.' },
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

const STATEMENT = `Design the class structure for an expense-sharing app (Splitwise-style): a group of users share expenses, each expense can be split among participants in different ways, and the system tracks who owes whom, simplified to the minimum number of settling transactions.

Functional requirements:
- Create a group of users.
- Record an expense paid by one user, split among some or all group members — equally, by exact amounts, or by percentage.
- Show each user's net balance with every other user.
- Simplify the group's debts to the minimum number of transactions needed to settle up.

Design expectations:
- A new split type should be addable without changing how an expense is recorded.
- Name the debt-simplification approach.
- Draw this as a class diagram: classes, interfaces, and typed relationships.`;

const REFERENCE_APPROACH = `Define a SplitStrategy interface with a method like computeShares(expense, participants): Map<User, Amount>, implemented by EqualSplit, ExactSplit, and PercentageSplit — recording a new Expense just selects a strategy and calls it, so adding a new split type never touches Expense or Group. A Group owns Users and Expenses; every recorded expense updates a running Balance (or Ledger) of net amounts between pairs of users, kept separate from the raw expense history, since "who owes whom right now" is a different, derived query from "what were the expenses" and shouldn't be re-computed from scratch every time. Debt simplification — collapsing a tangle of pairwise debts (A owes B, B owes C, C owes A) down to the minimum number of settling transactions — is a distinct algorithm (commonly modeled as a graph min-cash-flow problem) operating purely on the Balance data; neither Expense nor SplitStrategy need to know it exists.`;

export const SPLITWISE: DesignProblem = {
  slug: 'design-splitwise',
  track: 'lld',
  title: 'Design Splitwise',
  difficulty: 'Medium',
  statement: STATEMENT,
  rubric: SPLITWISE_RUBRIC,
  referenceApproach: REFERENCE_APPROACH,
  hints: [
    'Equal, exact, and percentage splits — what interface lets you add a fourth kind later without touching how an expense is recorded?',
    '"Who owes whom right now" and "what were all the expenses ever recorded" are two different questions. Should the first be recomputed from the second on every query?',
    'Use a SplitStrategy interface for the splitting logic, keep a running Balance/Ledger separate from raw expense history, and treat debt simplification as its own algorithm operating purely on that balance data.',
  ],
};
