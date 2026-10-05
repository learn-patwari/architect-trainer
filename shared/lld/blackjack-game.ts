import { allNodesLabeled, edgeLabelMatches, hasDominantNode, hasRole, implementorCount, keywordAnywhere } from '../rubric/checks.ts';
import type { RubricSpec } from '../rubric/types.ts';
import type { DesignProblem } from '../types.ts';

/**
 * A rules-engine + State-pattern LLD problem: the crux is separating hand
 * value calculation (ace's dual value is the classic gotcha) from turn-state
 * management (player-turn/dealer-turn/round-over), rather than one Game
 * class branching on both at once.
 */

const RELATIONSHIP_KEYWORDS = ['extends', 'implements', 'has-a', 'has a', 'uses', 'aggregates', 'composes'];

const BLACKJACK_RUBRIC: RubricSpec = {
  id: 'design-a-blackjack-game',
  title: 'Design a Blackjack Game — rubric',
  checks: [
    {
      id: 'has-abstraction',
      label: 'A round-state interface/abstract class is present',
      max: 3,
      run: (g) =>
        hasRole(g, 'interface') || hasRole(g, 'abstractClass')
          ? { points: 3, verdict: 'pass', detail: 'A state abstraction is present.' }
          : { points: 0, verdict: 'fail', detail: 'Model the round\'s progression with the State pattern (player-turn, dealer-turn, round-over), rather than one Game class branching on "whose turn is it" everywhere.' },
    },
    {
      id: 'polymorphism-used',
      label: 'At least two round states implement the abstraction',
      max: 3,
      run: (g) => {
        const n = implementorCount(g, ['interface', 'abstractClass']);
        if (n >= 2) return { points: 3, verdict: 'pass', detail: `${n} concrete states implement the abstraction.` };
        if (n === 1) return { points: 1, verdict: 'partial', detail: 'Only one state implements the abstraction — a round needs at least a couple of distinct phases to be worth modeling this way.' };
        return { points: 0, verdict: 'fail', detail: 'No concrete round-state class is wired to (implements/extends) the abstraction.' };
      },
    },
    {
      id: 'no-god-class',
      label: 'No single class does everything (a "god class")',
      max: 3,
      run: (g) =>
        hasDominantNode(g)
          ? { points: 0, verdict: 'fail', detail: 'One class accounts for a disproportionate share of the relationships here — a Game class computing hand values, dealer logic, and turn order all itself is the shape this checks for.' }
          : { points: 3, verdict: 'pass', detail: 'Responsibilities look reasonably distributed across classes.' },
    },
    {
      id: 'hand-value-separate',
      label: 'Hand-value calculation is its own concern, separate from turn logic',
      max: 3,
      run: (g) =>
        keywordAnywhere(g, ['hand value', 'calculatevalue', 'bust', 'soft hand', 'hard hand'])
          ? { points: 3, verdict: 'pass', detail: 'Hand-value calculation is named as its own concern.' }
          : {
              points: 0,
              verdict: 'fail',
              detail: 'Computing a hand\'s value — including an Ace counting as 1 or 11, whichever keeps the hand from busting — is a self-contained rule; name it as its own method/class, not folded into turn-state logic.',
            },
    },
    {
      id: 'dealer-strategy',
      label: "The dealer's fixed strategy (hit below a threshold, else stand) is named",
      max: 2,
      run: (g) =>
        keywordAnywhere(g, ['dealer', 'stand on 17', 'hit below'])
          ? { points: 2, verdict: 'pass', detail: "The dealer's strategy is named." }
          : { points: 0, verdict: 'fail', detail: "Name the dealer's own fixed rule (e.g. hit while under 17, stand otherwise) — it's non-negotiable game logic, distinct from a player's free choice." },
    },
    {
      id: 'deck-modeled',
      label: 'A deck/shoe manages cards and shuffling separately from a hand',
      max: 2,
      run: (g) =>
        keywordAnywhere(g, ['deck', 'shoe', 'shuffle'])
          ? { points: 2, verdict: 'pass', detail: 'A deck/shoe is modeled.' }
          : { points: 0, verdict: 'fail', detail: 'Model a Deck (or multi-deck Shoe) responsible for shuffling and dealing cards, separate from a Hand that just holds the cards it was dealt.' },
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

const STATEMENT = `Design the class structure for a single-table blackjack game: players are dealt cards, choose to hit or stand, and a dealer follows fixed rules, with a winner determined per player against the dealer.

Functional requirements:
- Deal two cards to each player and the dealer from a shuffled deck.
- Each player, in turn, can hit (take another card) or stand; going over 21 busts.
- After all players act, the dealer plays a fixed strategy (e.g. hit while under 17, stand at 17 or above).
- Determine each player's outcome (win/lose/push) against the dealer's final hand.

Design expectations:
- Draw this as a class diagram: classes, interfaces, and typed relationships — not an infrastructure diagram.`;

const REFERENCE_APPROACH = `The round's progression is modeled with the State pattern: a RoundState interface with concrete states PlayerTurnState, DealerTurnState, and RoundOverState, each defining what actions are valid and what happens next from that phase — this keeps "whose turn is it and what can happen now" out of one sprawling conditional. A Deck (or a multi-deck Shoe for a real casino table) owns shuffling and dealing cards, handed out to each Hand, which is a simple, dumb collection of cards belonging to a player or the dealer. Hand-value calculation is pulled into its own method (on Hand, or a standalone calculator): sum card values, and specifically handle the Ace's dual value (1 or 11) by choosing whichever total is highest without busting — the single most common source of a buggy naive implementation, and worth isolating precisely because it's a self-contained rule that shouldn't be tangled into turn-state logic. The dealer's behavior is a separate, fixed strategy (hit while under 17, stand at 17+) rather than a player's free choice — worth modeling explicitly as non-negotiable game logic (e.g. a DealerStrategy with one hard-coded implementation), distinct from how a Player decides. A Game (or Round) class orchestrates by delegating to the current RoundState, the Deck, and each Hand's value calculation, rather than computing hand values, dealer logic, and turn order all directly itself.`;

export const BLACKJACK_GAME: DesignProblem = {
  slug: 'design-a-blackjack-game',
  track: 'lld',
  title: 'Design a Blackjack Game',
  difficulty: 'Medium',
  statement: STATEMENT,
  rubric: BLACKJACK_RUBRIC,
  referenceApproach: REFERENCE_APPROACH,
  hints: [
    'An Ace can count as 1 or 11, whichever keeps the hand from busting. Where should that rule live — buried in turn logic, or somewhere self-contained?',
    'The round moves through distinct phases (players act, then the dealer acts, then it\'s over) with different valid actions in each. What pattern models that cleanly?',
    'Use the State pattern for round progression (player-turn/dealer-turn/round-over), pull hand-value calculation (including the Ace rule) into its own method, and give the dealer its own fixed strategy separate from a player\'s free choice.',
  ],
};
