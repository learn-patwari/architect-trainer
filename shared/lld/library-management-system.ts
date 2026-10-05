import { allNodesLabeled, edgeLabelMatches, hasDominantNode, hasRole, implementorCount, keywordAnywhere } from '../rubric/checks.ts';
import type { RubricSpec } from '../rubric/types.ts';
import type { DesignProblem } from '../types.ts';

/**
 * An Easy-tier LLD problem, and one of the most commonly recommended first class-
 * design exercises: fewer moving parts than the parking lot (no concurrency, one
 * obvious strategy point — search — instead of several), but the same core shape.
 */

const RELATIONSHIP_KEYWORDS = ['extends', 'implements', 'has-a', 'has a', 'uses', 'aggregates', 'composes'];

const LIBRARY_RUBRIC: RubricSpec = {
  id: 'design-a-library-management-system',
  title: 'Design a Library Management System — rubric',
  checks: [
    {
      id: 'has-abstraction',
      label: 'An interface or abstract class is present',
      max: 3,
      run: (g) =>
        hasRole(g, 'interface') || hasRole(g, 'abstractClass')
          ? { points: 3, verdict: 'pass', detail: 'An interface or abstract class is present.' }
          : { points: 0, verdict: 'fail', detail: 'Name at least one abstraction — e.g. a SearchStrategy interface (search by title/author/ISBN), or a NotificationStrategy for overdue reminders.' },
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
          ? { points: 0, verdict: 'fail', detail: 'One class accounts for a disproportionate share of all the relationships in this diagram — a sign it\'s doing too much; delegate to collaborators.' }
          : { points: 3, verdict: 'pass', detail: 'Responsibilities look reasonably distributed across classes.' },
    },
    {
      id: 'enum-named',
      label: 'An enum is used for a fixed set of variants (e.g. book status)',
      max: 2,
      run: (g) =>
        hasRole(g, 'enumType')
          ? { points: 2, verdict: 'pass', detail: 'An enum is named for a fixed set of variants.' }
          : { points: 0, verdict: 'fail', detail: 'A book\'s status (available, checked out, reserved, lost) is a small fixed set — model it as an enum rather than a free-text field.' },
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
      id: 'fine-or-due-date-named',
      label: 'Due dates and overdue fines are modeled',
      max: 2,
      run: (g) =>
        keywordAnywhere(g, ['fine', 'late fee', 'due date', 'overdue'])
          ? { points: 2, verdict: 'pass', detail: 'Due dates / overdue fines are modeled.' }
          : { points: 0, verdict: 'fail', detail: 'A checkout needs a due date, and an overdue one needs a fine calculation — name where that lives (e.g. on a Loan/Checkout record).' },
    },
    {
      id: 'orchestrator-present',
      label: 'A top-level Library/Catalog class coordinates the rest',
      max: 2,
      run: (g) =>
        keywordAnywhere(g, ['library', 'catalog'])
          ? { points: 2, verdict: 'pass', detail: 'A top-level coordinating class is present.' }
          : { points: 0, verdict: 'fail', detail: 'Model the library itself as a class that owns the catalog and exposes checkout()/return()/search() — without it, books and members have no home.' },
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

const STATEMENT = `Design the class structure for a library management system.

Functional requirements:
- Search the catalog by title, author, or ISBN.
- Check out a book to a member, and check it back in.
- Track due dates, and charge a fine when a book is returned late.
- Reserve a book that's currently checked out, and notify the member when it's returned.

Design expectations:
- Use an interface or abstract class somewhere a real interviewer would expect polymorphism (search strategy, or how a member is notified).
- Name the classes and the relationships between them (extends / implements / has-a / uses) — draw it as a class diagram, not an infrastructure diagram.`;

const REFERENCE_APPROACH = `Model Book (title, author, ISBN, a BookStatus enum: AVAILABLE / CHECKED_OUT / RESERVED / LOST) and Member as plain classes owned by a top-level Library, which also owns the Catalog. Search is the natural Strategy-pattern seam: a SearchStrategy interface with TitleSearch, AuthorSearch, and IsbnSearch implementations lets the catalog support new search criteria without the catalog itself branching on a type flag. Checking out a book creates a Loan (book, member, checkout date, due date); returning it computes days-late × a per-day rate if overdue, ideally behind its own FineCalculator so the rate/policy can change independently of the checkout flow. Reservation is a second, smaller Strategy-like seam: a Reservation record links a member to a currently-unavailable book, and a NotificationStrategy interface (EmailNotification, SmsNotification) decouples "notify the member" from how the notification is actually delivered. The failure mode this rubric is checking for is a single Library "god class" that also validates ISBNs, computes fines, and sends emails itself — each of those is a natural, separate collaborator.`;

export const LIBRARY_MANAGEMENT_SYSTEM: DesignProblem = {
  slug: 'design-a-library-management-system',
  track: 'lld',
  title: 'Design a Library Management System',
  difficulty: 'Easy',
  statement: STATEMENT,
  rubric: LIBRARY_RUBRIC,
  referenceApproach: REFERENCE_APPROACH,
  hints: [
    'Search by title, author, or ISBN — what pattern lets you add a fourth kind of search later without an if/else chain?',
    'A book\'s status (available, checked out, reserved, lost) is a small, fixed set. What should model that?',
    'Use a SearchStrategy interface with TitleSearch/AuthorSearch/IsbnSearch implementations, a BookStatus enum, and a Loan record that tracks the due date so a fine can be computed on return.',
  ],
};
