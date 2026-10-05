import { allNodesLabeled, edgeLabelMatches, hasDominantNode, hasRole, implementorCount, keywordAnywhere } from '../rubric/checks.ts';
import type { RubricSpec } from '../rubric/types.ts';
import type { DesignProblem } from '../types.ts';

/**
 * The biggest-object-graph LLD problem in this set: six piece types each with
 * their own movement rule is the clearest possible case for polymorphism over
 * a type switch, and check/checkmate detection is a distinct concern from
 * "can this one piece move here."
 */

const RELATIONSHIP_KEYWORDS = ['extends', 'implements', 'has-a', 'has a', 'uses', 'aggregates', 'composes'];

const CHESS_RUBRIC: RubricSpec = {
  id: 'design-a-chess-game',
  title: 'Design a Chess Game — rubric',
  checks: [
    {
      id: 'has-abstraction',
      label: 'A Piece interface/abstract class is present',
      max: 3,
      run: (g) =>
        hasRole(g, 'interface') || hasRole(g, 'abstractClass')
          ? { points: 3, verdict: 'pass', detail: 'A Piece abstraction is present.' }
          : { points: 0, verdict: 'fail', detail: 'Name a Piece interface/abstract class so each piece type implements its own movement rule, rather than one big switch on piece type.' },
    },
    {
      id: 'polymorphism-used',
      label: 'At least two piece types implement the abstraction',
      max: 3,
      run: (g) => {
        const n = implementorCount(g, ['interface', 'abstractClass']);
        if (n >= 2) return { points: 3, verdict: 'pass', detail: `${n} concrete piece types implement the abstraction.` };
        if (n === 1) return { points: 1, verdict: 'partial', detail: 'Only one piece type implements the abstraction — chess has six distinct movement rules.' };
        return { points: 0, verdict: 'fail', detail: 'No concrete piece type is wired to (implements/extends) the Piece abstraction.' };
      },
    },
    {
      id: 'no-god-class',
      label: 'No single class does everything (a "god class")',
      max: 3,
      run: (g) =>
        hasDominantNode(g)
          ? { points: 0, verdict: 'fail', detail: 'One class accounts for a disproportionate share of the relationships here — a Board that also implements every piece\'s movement rules and check detection is the shape this checks for.' }
          : { points: 3, verdict: 'pass', detail: 'Responsibilities look reasonably distributed across classes.' },
    },
    {
      id: 'enum-named',
      label: 'An enum models color or game status',
      max: 2,
      run: (g) =>
        hasRole(g, 'enumType')
          ? { points: 2, verdict: 'pass', detail: 'An enum is named.' }
          : { points: 0, verdict: 'fail', detail: 'Piece color (WHITE/BLACK) and game status (IN_PROGRESS/CHECK/CHECKMATE/STALEMATE) are small fixed sets — model them as enums.' },
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
      id: 'move-validation-named',
      label: 'Move validation / legal-move checking is named',
      max: 2,
      run: (g) =>
        keywordAnywhere(g, ['move validation', 'legal move', 'valid moves'])
          ? { points: 2, verdict: 'pass', detail: 'Move validation is named.' }
          : { points: 0, verdict: 'fail', detail: 'Say what validates that a requested move is actually legal for the piece (and doesn\'t leave the mover\'s own king in check).' },
    },
    {
      id: 'check-checkmate-named',
      label: 'Check / checkmate / stalemate detection is named',
      max: 3,
      run: (g) =>
        keywordAnywhere(g, ['check', 'checkmate', 'stalemate'])
          ? { points: 3, verdict: 'pass', detail: 'Check/checkmate/stalemate detection is named.' }
          : { points: 0, verdict: 'fail', detail: 'Name what detects check, checkmate, and stalemate after a move — this needs to look at the whole board, not just one piece, so it doesn\'t belong inside Piece itself.' },
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

const STATEMENT = `Design the class structure for a two-player chess game: pieces move according to their own rules, and the game detects check, checkmate, and stalemate.

Functional requirements:
- Each piece type (pawn, rook, knight, bishop, queen, king) moves according to its own distinct rules.
- A move is rejected if it's not legal for that piece, or if it would leave the mover's own king in check.
- Detect check, checkmate, and stalemate after each move.

Design expectations:
- Use an interface or abstract class so each piece type implements its own movement logic, rather than one big switch on piece type.
- Pull check/checkmate detection into its own concept, separate from how an individual piece moves.
- Draw this as a class diagram: classes, interfaces, and typed relationships.`;

const REFERENCE_APPROACH = `Model an abstract Piece class (or interface) with a Color and a canMove(board, from, to): boolean method, implemented separately by Pawn, Rook, Knight, Bishop, Queen, and King — each encoding only its own movement rule, so the game loop never branches on piece type. A Board holds an 8x8 grid of Piece references (or nulls) and exposes movePiece(from, to), but delegates the actual legality check to the piece being moved plus a separate concern: a move that's legal for the piece in isolation can still be illegal if it leaves the mover's own king in check, which is exactly why check/checkmate detection belongs in its own class (a ChessRuleEngine or GameState) rather than inside Board or Piece — it needs to look at the whole board, not just one piece's movement pattern, and folding "does this leave me in check" into the definition of a legal move (rather than treating check as an afterthought) is what a real chess engine actually does. After a legal move, the rule engine checks whether the opponent's king is in check, and if so, whether any legal move exists that escapes it (checkmate) or, absent check, whether the opponent has no legal move at all (stalemate). A Color enum (WHITE/BLACK) and a GameStatus enum (IN_PROGRESS/CHECK/CHECKMATE/STALEMATE) model their respective small, fixed sets. The god-class failure mode here is a Board or Game class that also implements every piece's movement rules and the check-detection logic directly — each belongs to Piece and the rule engine respectively.`;

export const CHESS_GAME: DesignProblem = {
  slug: 'design-a-chess-game',
  track: 'lld',
  title: 'Design a Chess Game',
  difficulty: 'Hard',
  statement: STATEMENT,
  rubric: CHESS_RUBRIC,
  referenceApproach: REFERENCE_APPROACH,
  hints: [
    'Six different piece types, each moving completely differently. What keeps the game loop from having a giant switch statement on piece type?',
    'A move can be perfectly legal for the piece itself and still be illegal for the game overall. What\'s actually being checked in that second case?',
    'Give Piece an abstract canMove() that each piece type implements, and pull check/checkmate/stalemate detection into its own rule-engine class that looks at the whole board — not into Piece or Board directly.',
  ],
};
