import { allNodesLabeled, edgeLabelMatches, hasDominantNode, hasRole, implementorCount, keywordAnywhere } from '../rubric/checks.ts';
import type { RubricSpec } from '../rubric/types.ts';
import type { DesignProblem } from '../types.ts';

/**
 * The canonical Composite-pattern LLD problem: a directory contains files AND
 * other directories, and the whole point is treating both uniformly through
 * one shared abstraction rather than branching on which kind of entry it is.
 */

const RELATIONSHIP_KEYWORDS = ['extends', 'implements', 'has-a', 'has a', 'uses', 'aggregates', 'composes'];

const FILE_SYSTEM_RUBRIC: RubricSpec = {
  id: 'design-an-in-memory-file-system',
  title: 'Design an In-Memory File System — rubric',
  checks: [
    {
      id: 'has-abstraction',
      label: 'An Entry interface/abstract class is present',
      max: 3,
      run: (g) =>
        hasRole(g, 'interface') || hasRole(g, 'abstractClass')
          ? { points: 3, verdict: 'pass', detail: 'An Entry abstraction is present.' }
          : { points: 0, verdict: 'fail', detail: 'Name a common Entry interface/abstract class so File and Directory can be treated the same way by operations like delete or getSize.' },
    },
    {
      id: 'polymorphism-used',
      label: 'File and Directory both implement the abstraction',
      max: 3,
      run: (g) => {
        const n = implementorCount(g, ['interface', 'abstractClass']);
        if (n >= 2) return { points: 3, verdict: 'pass', detail: `${n} concrete entry types implement the abstraction.` };
        if (n === 1) return { points: 1, verdict: 'partial', detail: 'Only one entry type implements the abstraction — a file system needs both File and Directory.' };
        return { points: 0, verdict: 'fail', detail: 'No concrete entry type is wired to (implements/extends) the Entry abstraction.' };
      },
    },
    {
      id: 'no-god-class',
      label: 'No single class does everything (a "god class")',
      max: 3,
      run: (g) =>
        hasDominantNode(g)
          ? { points: 0, verdict: 'fail', detail: 'One class accounts for a disproportionate share of the relationships here — a FileSystem that also walks paths AND stores all content directly is the shape this checks for.' }
          : { points: 3, verdict: 'pass', detail: 'Responsibilities look reasonably distributed across classes.' },
    },
    {
      id: 'enum-named',
      label: 'An enum models entry type or permissions',
      max: 2,
      run: (g) =>
        hasRole(g, 'enumType')
          ? { points: 2, verdict: 'pass', detail: 'An enum is named.' }
          : { points: 0, verdict: 'fail', detail: 'Whether an entry is a FILE or a DIRECTORY (or its permission set) is a small fixed set — model it as an enum.' },
    },
    {
      id: 'typed-relationships',
      label: 'Relationships between classes are typed, not generic arrows',
      max: 2,
      run: (g) =>
        edgeLabelMatches(g, RELATIONSHIP_KEYWORDS)
          ? { points: 2, verdict: 'pass', detail: 'At least one relationship is explicitly typed.' }
          : { points: 0, verdict: 'fail', detail: 'Label at least one arrow with what kind of relationship it is (implements, has-a, uses) — Directory has-a collection of child Entry objects.' },
    },
    {
      id: 'path-resolution-named',
      label: 'Path resolution is named as its own concern',
      max: 2,
      run: (g) =>
        keywordAnywhere(g, ['path resolution', 'absolute path', 'tokeniz'])
          ? { points: 2, verdict: 'pass', detail: 'Path resolution is named.' }
          : { points: 0, verdict: 'fail', detail: 'Say how a string like "/a/b/c.txt" is turned into an actual reference to a node (tokenize on "/" and walk from the root) — this is the actual algorithmic core of the problem.' },
    },
    {
      id: 'composite-structure-named',
      label: 'The composite/recursive tree structure is named',
      max: 2,
      run: (g) =>
        keywordAnywhere(g, ['composite', 'tree structure', 'recursive'])
          ? { points: 2, verdict: 'pass', detail: 'The composite tree structure is named.' }
          : { points: 0, verdict: 'fail', detail: 'Name the fact that a Directory can contain other Directories recursively (the Composite pattern) — this is the whole point of the abstraction.' },
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

const STATEMENT = `Design the class structure for an in-memory file system: directories contain files and other directories (nested arbitrarily deep), and you can create, read, list, and delete by path.

Functional requirements:
- mkdir(path), createFile(path, content), readFile(path), ls(path), delete(path).
- A directory can contain both files and other directories, nested to any depth.
- Resolve a path like "/a/b/c.txt" into the actual node it refers to.

Design expectations:
- Treat files and directories uniformly wherever possible, so an operation like "get size" or "delete" doesn't need to check which kind of node it's looking at.
- Draw this as a class diagram: classes, interfaces, and typed relationships.`;

const REFERENCE_APPROACH = `Model a common Entry abstraction (interface or abstract class) with a name and a getSize() method, implemented by both File (holding content and a byte size) and Directory (holding a collection of child Entry references, whose size is the sum of its children's) — this is the Composite pattern: a Directory can contain either Files or other Directories interchangeably, because both are just Entry to any code that doesn't care which. Path resolution is its own concern: given "/a/b/c.txt", tokenize on "/" and walk from the root Directory through each child lookup in turn, failing if any intermediate segment isn't a Directory or doesn't exist — this recursive/iterative walk is the actual algorithmic piece of the problem, separate from what a File or Directory does once found. A FileSystem (or a root Directory acting as the entry point) exposes the public operations (mkdir, createFile, readFile, ls, delete), each of which resolves its path argument and then delegates to the resolved node. An EntryType enum (FILE/DIRECTORY) can back quick type checks without instanceof scattered everywhere, though the Composite abstraction should already handle most operations polymorphically. The god-class failure mode is a single FileSystem class that walks paths itself AND stores all the actual file content directly in nested maps — path resolution, storage, and per-entry behavior belong to Entry/File/Directory and a dedicated path resolver instead.`;

export const IN_MEMORY_FILE_SYSTEM: DesignProblem = {
  slug: 'design-an-in-memory-file-system',
  track: 'lld',
  title: 'Design an In-Memory File System',
  difficulty: 'Medium',
  statement: STATEMENT,
  rubric: FILE_SYSTEM_RUBRIC,
  referenceApproach: REFERENCE_APPROACH,
  hints: [
    'A directory contains files AND other directories, nested arbitrarily deep. What single abstraction lets you treat both the same way for operations like "delete" or "get size"?',
    '"/a/b/c.txt" needs to become an actual reference to a node. What\'s the algorithm, and where should it live — inside Directory, or somewhere else?',
    'Use the Composite pattern: a common Entry interface implemented by both File and Directory, with Directory holding a list of child Entry objects — and put path-splitting/walking in its own resolver, not scattered across every public method.',
  ],
};
