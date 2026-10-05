import { allNodesLabeled, edgeLabelMatches, hasDominantNode, hasRole, implementorCount, keywordAnywhere } from '../rubric/checks.ts';
import type { RubricSpec } from '../rubric/types.ts';
import type { DesignProblem } from '../types.ts';

/**
 * The classic "state machine + Strategy pattern + coordinating multiple
 * instances" LLD problem — frequently cited as a Microsoft favorite. Reuses
 * every existing class-design primitive.
 */

const RELATIONSHIP_KEYWORDS = ['extends', 'implements', 'has-a', 'has a', 'uses', 'aggregates', 'composes'];

const ELEVATOR_RUBRIC: RubricSpec = {
  id: 'design-an-elevator-system',
  title: 'Design an Elevator System — rubric',
  checks: [
    {
      id: 'has-abstraction',
      label: 'A scheduling-strategy interface/abstract class is present',
      max: 3,
      run: (g) =>
        hasRole(g, 'interface') || hasRole(g, 'abstractClass')
          ? { points: 3, verdict: 'pass', detail: 'A scheduling-strategy abstraction is present.' }
          : { points: 0, verdict: 'fail', detail: 'Name a scheduling/dispatch strategy interface so the algorithm deciding which elevator serves a request is swappable.' },
    },
    {
      id: 'polymorphism-used',
      label: 'At least two scheduling strategies implement the abstraction',
      max: 3,
      run: (g) => {
        const n = implementorCount(g, ['interface', 'abstractClass']);
        if (n >= 2) return { points: 3, verdict: 'pass', detail: `${n} concrete strategies implement the abstraction.` };
        if (n === 1) return { points: 1, verdict: 'partial', detail: 'Only one strategy implements the abstraction — with just one, the interface isn\'t buying anything yet.' };
        return { points: 0, verdict: 'fail', detail: 'No concrete strategy is wired to (implements/extends) the scheduling abstraction.' };
      },
    },
    {
      id: 'no-god-class',
      label: 'No single class does everything (a "god class")',
      max: 3,
      run: (g) =>
        hasDominantNode(g)
          ? { points: 0, verdict: 'fail', detail: 'One class accounts for a disproportionate share of the relationships here — a controller that also manages motor state and door logic directly is the shape this checks for.' }
          : { points: 3, verdict: 'pass', detail: 'Responsibilities look reasonably distributed across classes.' },
    },
    {
      id: 'enum-named',
      label: 'An enum models elevator state or direction',
      max: 2,
      run: (g) =>
        hasRole(g, 'enumType')
          ? { points: 2, verdict: 'pass', detail: 'An enum is named for state/direction.' }
          : { points: 0, verdict: 'fail', detail: 'Elevator state (idle, moving up, moving down, doors open) and direction are small fixed sets — model them as an enum.' },
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
      id: 'concurrency-named',
      label: 'Thread-safety for concurrent requests is named',
      max: 3,
      run: (g) =>
        keywordAnywhere(g, ['thread-safe', 'thread safe', 'synchronized', 'concurrent request queue', 'lock'])
          ? { points: 3, verdict: 'pass', detail: 'A concurrency-safety mechanism is named.' }
          : { points: 0, verdict: 'fail', detail: 'Multiple floor buttons can be pressed at the same instant from different threads — say how each elevator\'s request queue stays safe under that.' },
    },
    {
      id: 'multi-elevator-coordination',
      label: 'A dispatcher/controller coordinates multiple elevator cars',
      max: 2,
      run: (g) =>
        keywordAnywhere(g, ['dispatcher', 'controller', 'elevator controller', 'elevator manager'])
          ? { points: 2, verdict: 'pass', detail: 'A coordinating dispatcher/controller is named.' }
          : { points: 0, verdict: 'fail', detail: 'Name the class that owns multiple Elevator instances and decides which one handles an incoming request — a building has more than one car.' },
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

const STATEMENT = `Design the class structure for an elevator control system in a building with multiple elevators and multiple floors. The system must handle simultaneous requests (floor call buttons and in-cabin destination buttons) and dispatch elevators efficiently.

Functional requirements:
- A user on any floor can call an elevator (up or down).
- A user inside a car can select a destination floor.
- Multiple elevator cars are coordinated by a central dispatcher.
- The system keeps working correctly when many requests arrive at once.

Design expectations:
- Model elevator state as a small, fixed set (idle, moving up, moving down, doors open).
- Make the scheduling/dispatch algorithm swappable (e.g. nearest-car vs. a "scan" algorithm) without changing Elevator itself.
- Draw this as a class diagram: classes, interfaces, and typed relationships.`;

const REFERENCE_APPROACH = `Model an ElevatorState enum (Idle, MovingUp, MovingDown, DoorsOpen) and a Direction enum. Define a SchedulingStrategy interface (e.g. selectElevator(request): Elevator) with concrete implementations like NearestCarStrategy and ScanStrategy (the classic elevator "look" algorithm — service every request in one direction before reversing) — this is the natural Strategy-pattern seam, so swapping the dispatch algorithm never touches Elevator or the controller. An ElevatorController owns a collection of Elevator instances and, for every incoming request, asks the current SchedulingStrategy which car should serve it, then enqueues the stop on that car's own request queue. Each Elevator manages its own state machine and request queue independently; since requests arrive concurrently from multiple floor buttons, each elevator's request queue must be thread-safe (synchronized, or a concurrent queue). Avoid a god-class ElevatorController that also tracks door state and motor commands directly — those belong on Elevator itself, with the controller only responsible for dispatch.`;

export const ELEVATOR_SYSTEM: DesignProblem = {
  slug: 'design-an-elevator-system',
  track: 'lld',
  title: 'Design an Elevator System',
  difficulty: 'Hard',
  statement: STATEMENT,
  rubric: ELEVATOR_RUBRIC,
  referenceApproach: REFERENCE_APPROACH,
  hints: [
    'Which class should decide which of several elevator cars answers a new request?',
    'The dispatch algorithm (nearest-car vs. a scan/"look" algorithm) needs to be swappable — what pattern gives you that without touching Elevator itself?',
    'A SchedulingStrategy interface with multiple implementations picks which Elevator serves a request; an ElevatorController owns all the cars and asks the strategy, while each Elevator keeps its own thread-safe request queue.',
  ],
};
