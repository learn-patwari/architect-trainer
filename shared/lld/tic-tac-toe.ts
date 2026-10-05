import { allNodesLabeled, edgeLabelMatches, hasDominantNode, hasRole, implementorCount, keywordAnywhere } from '../rubric/checks.ts';
import type { RubricSpec } from '../rubric/types.ts';
import type { DesignProblem } from '../types.ts';

/**
 * A game-framework LLD problem: the interesting decision is separating the
 * board, the player abstraction, and the win-checking rule so each can vary
 * independently — the classic "what if the board were 5x5" follow-up.
 */

const RELATIONSHIP_KEYWORDS = ['extends', 'implements', 'has-a', 'has a', 'uses', 'aggregates', 'composes'];

const TIC_TAC_TOE_RUBRIC: RubricSpec = {
  id: 'design-tic-tac-toe',
  title: 'Design Tic-Tac-Toe — rubric',
  checks: [
    {
      id: 'has-abstraction',
      label: 'A Player interface/abstract class is present',
      max: 3,
      run: (g) =>
        hasRole(g, 'interface') || hasRole(g, 'abstractClass')
          ? { points: 3, verdict: 'pass', detail: 'A player abstraction is present.' }
          : { points: 0, verdict: 'fail', detail: 'Name a Player interface/abstract class so the game loop can ask for a move without caring whether it\'s a human or an AI.' },
    },
    {
      id: 'polymorphism-used',
      label: 'At least two concrete player types implement the abstraction',
      max: 3,
      run: (g) => {
        const n = implementorCount(g, ['interface', 'abstractClass']);
        if (n >= 2) return { points: 3, verdict: 'pass', detail: `${n} concrete player types implement the abstraction.` };
        if (n === 1) return { points: 1, verdict: 'partial', detail: 'Only one player type implements the abstraction.' };
        return { points: 0, verdict: 'fail', detail: 'No concrete player type is wired to (implements/extends) the Player abstraction.' };
      },
    },
    {
      id: 'no-god-class',
      label: 'No single class does everything (a "god class")',
      max: 3,
      run: (g) =>
        hasDominantNode(g)
          ? { points: 0, verdict: 'fail', detail: 'One class accounts for a disproportionate share of the relationships here — a Board that also picks moves and checks wins directly is the shape this checks for.' }
          : { points: 3, verdict: 'pass', detail: 'Responsibilities look reasonably distributed across classes.' },
    },
    {
      id: 'enum-named',
      label: 'An enum models the cell/symbol state',
      max: 2,
      run: (g) =>
        hasRole(g, 'enumType')
          ? { points: 2, verdict: 'pass', detail: 'An enum is named for cell state.' }
          : { points: 0, verdict: 'fail', detail: 'A cell is Empty, X, or O — a small fixed set. Model it as an enum rather than a raw char or int.' },
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
      id: 'win-condition-separated',
      label: 'Win-checking is its own concept, separate from the board',
      max: 3,
      run: (g) =>
        keywordAnywhere(g, ['winning strategy', 'win condition', 'win checker', 'winningstrategy'])
          ? { points: 3, verdict: 'pass', detail: 'A distinct win-condition concept is named.' }
          : { points: 0, verdict: 'fail', detail: 'Pull win-checking out into its own class/strategy rather than burying it inside Board or the game loop — that\'s what makes changing the win condition a config change instead of a rewrite.' },
    },
    {
      id: 'extensibility-named',
      label: 'Extensibility to a different board size is named',
      max: 2,
      run: (g) =>
        keywordAnywhere(g, ['nxn', 'configurable board size', 'extensible board', 'n x n'])
          ? { points: 2, verdict: 'pass', detail: 'Board-size extensibility is named.' }
          : { points: 0, verdict: 'fail', detail: 'Say that the board size (e.g. NxN) is a constructor parameter, not a hardcoded 3x3 — this is the concrete detail the "extensible" requirement is testing for.' },
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

const STATEMENT = `Design the class structure for a two-player Tic-Tac-Toe game, built so the board size (3x3 today, NxN later) and the win condition could be extended without rewriting the game loop.

Functional requirements:
- Two players take turns placing their symbol on the board.
- Detect a win (a full row, column, or diagonal) or a draw.
- Support at least two kinds of players (e.g. a human and a simple AI).

Design expectations:
- Separate the board, the player abstraction, and the win-checking logic so each can vary independently.
- Draw this as a class diagram: classes, interfaces, and typed relationships.`;

const REFERENCE_APPROACH = `A Board class holds an NxN grid of a Symbol enum (Empty, X, O) — sizing it via a constructor parameter rather than hardcoding 3x3 is what makes it extensible to larger boards. A Player abstraction (interface or abstract class) with HumanPlayer and AIPlayer implementations lets the game loop call player.getMove(board) polymorphically without caring which kind of player it's talking to. Win-checking lives in its own WinningStrategy (checking rows/columns/diagonals, or a generalized "k in a row" rule for larger boards) rather than inside Board or the game loop — this is exactly what turns "what if the board were 5x5 needing 4 in a row" into a config change instead of a rewrite. A Game class orchestrates turns, delegating to Board, the current Player, and WinningStrategy rather than reimplementing any of their logic itself.`;

export const TIC_TAC_TOE: DesignProblem = {
  slug: 'design-tic-tac-toe',
  track: 'lld',
  title: 'Design Tic-Tac-Toe',
  difficulty: 'Easy',
  statement: STATEMENT,
  rubric: TIC_TAC_TOE_RUBRIC,
  referenceApproach: REFERENCE_APPROACH,
  hints: [
    'The board should work for a 5x5 grid needing 4-in-a-row later, without a rewrite. What must NOT be hardcoded?',
    'Where should win-checking live so it isn\'t tangled up with the board\'s own state?',
    'Make board size a constructor parameter, put win-checking in its own WinningStrategy class, and give Player an interface so a HumanPlayer and an AIPlayer are interchangeable to the game loop.',
  ],
};
