import { allNodesLabeled, keywordAnywhere, redundancyEvidence } from '../rubric/checks.ts';
import type { RubricSpec } from '../rubric/types.ts';
import type { DesignProblem } from '../types.ts';

/**
 * Design the storage system itself (S3-shaped), not "use S3 as a building
 * block" the way most other problems do — the crux is splitting metadata
 * (key -> location) from the actual object bytes (chunked, erasure-coded
 * or replicated across physical nodes), plus durability being the headline
 * feature, distinct from every other problem's normal "just add a datastore."
 */

const METADATA_SERVICE_KEYWORDS = ['metadata service', 'metadata store', 'key-to-location', 'namespace service'];
const CHUNKING_KEYWORDS = ['chunk', 'chunking', 'shard the object', 'block-level'];
const REPLICATION_OR_ERASURE_KEYWORDS = ['replication', 'replica', 'erasure coding', 'erasure-coded', 'reed-solomon'];
const CONSISTENT_HASHING_KEYWORDS = ['consistent hashing', 'hash ring'];
const DURABILITY_KEYWORDS = ['eleven nines', '11 nines', 'durability', 'checksum', 'bit rot'];
const VERSIONING_KEYWORDS = ['versioning', 'immutable object', 'write-once'];
const GC_KEYWORDS = ['garbage collect', 'garbage collection', 'tombstone'];

const OBJECT_STORAGE_SYSTEM_RUBRIC: RubricSpec = {
  id: 'design-s3-like-object-storage',
  title: 'Design an S3-like Object Storage System — rubric',
  checks: [
    {
      id: 'metadata-vs-data-split',
      label: 'Metadata (key -> location) is split from the actual object data',
      max: 3,
      run: (g) =>
        keywordAnywhere(g, METADATA_SERVICE_KEYWORDS)
          ? { points: 3, verdict: 'pass', detail: 'A separate metadata layer is named.' }
          : {
              points: 0,
              verdict: 'fail',
              detail: 'Name the split explicitly: a metadata service mapping a bucket/key to where the object\'s data physically lives, separate from the data-node fleet storing the actual bytes.',
            },
    },
    {
      id: 'chunking-named',
      label: 'Large objects are split into chunks',
      max: 3,
      run: (g) =>
        keywordAnywhere(g, CHUNKING_KEYWORDS)
          ? { points: 3, verdict: 'pass', detail: 'Chunking is named.' }
          : { points: 0, verdict: 'fail', detail: 'A multi-gigabyte object shouldn\'t be one indivisible unit on one node — name splitting it into fixed-size chunks distributed across data nodes.' },
    },
    {
      id: 'placement-scheme',
      label: 'Chunk placement across data nodes uses consistent hashing',
      max: 2,
      run: (g) =>
        keywordAnywhere(g, CONSISTENT_HASHING_KEYWORDS)
          ? { points: 2, verdict: 'pass', detail: 'Consistent hashing is named for chunk placement.' }
          : { points: 0, verdict: 'fail', detail: 'Say how a chunk is assigned to a data node — consistent hashing, so adding/removing nodes doesn\'t reshuffle nearly everything.' },
    },
    {
      id: 'durability-mechanism',
      label: 'A durability mechanism (replication or erasure coding) is named',
      max: 4,
      run: (g) =>
        keywordAnywhere(g, REPLICATION_OR_ERASURE_KEYWORDS)
          ? { points: 4, verdict: 'pass', detail: 'A durability mechanism is named.' }
          : {
              points: 0,
              verdict: 'fail',
              detail: 'Durability is the headline promise of an object store — name the actual mechanism: replicate each chunk to multiple nodes, or erasure-code it (store the data as N data fragments plus M parity fragments) for the same durability at lower storage overhead.',
            },
    },
    {
      id: 'integrity-checking',
      label: 'Data-integrity checking (checksums, bit rot) is named',
      max: 2,
      run: (g) =>
        keywordAnywhere(g, DURABILITY_KEYWORDS)
          ? { points: 2, verdict: 'pass', detail: 'Integrity checking is named.' }
          : { points: 0, verdict: 'fail', detail: 'A disk can silently corrupt a byte (bit rot) without failing outright — name checksums (verified on read, and via periodic background scrubbing) to catch it.' },
    },
    {
      id: 'immutability-versioning',
      label: 'Objects are treated as immutable, with versioning for overwrites',
      max: 2,
      run: (g) =>
        keywordAnywhere(g, VERSIONING_KEYWORDS)
          ? { points: 2, verdict: 'pass', detail: 'Immutability/versioning is named.' }
          : { points: 0, verdict: 'fail', detail: 'Say that a PUT to an existing key creates a new version/object rather than mutating bytes in place — this is what makes replication and caching straightforward.' },
    },
    {
      id: 'deletion-gc',
      label: 'Deleted/overwritten data is garbage-collected, not deleted synchronously',
      max: 2,
      run: (g) =>
        keywordAnywhere(g, GC_KEYWORDS)
          ? { points: 2, verdict: 'pass', detail: 'Async garbage collection is named.' }
          : { points: 0, verdict: 'fail', detail: 'Say how a deleted object\'s chunks are actually reclaimed — marked as a tombstone and garbage-collected asynchronously, not synchronously deleted from every replica on the delete call.' },
    },
    {
      id: 'nodes-redundant',
      label: 'More than one data node is drawn',
      max: 2,
      run: (g) =>
        redundancyEvidence(g, 'datastore')
          ? { points: 2, verdict: 'pass', detail: 'Multiple data nodes are shown.' }
          : { points: 0, verdict: 'fail', detail: 'Draw more than one data node — durability and chunk distribution only mean something across several of them.' },
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

const STATEMENT = `Design an S3-like object storage system: the storage layer itself, not a system built on top of one — arbitrary-sized blobs stored under a key, retrievable by that key, with extreme durability guarantees.

Functional requirements:
- put(bucket, key, bytes) and get(bucket, key) for objects ranging from a few bytes to many gigabytes.
- An object, once written, is effectively never lost — even multiple simultaneous hardware failures shouldn't lose data.
- Overwriting a key doesn't corrupt an in-progress read of the previous version.

Non-functional requirements / scale:
- Exabytes of total data, across a huge fleet of commodity storage nodes that fail routinely.
- Reads and writes at high throughput, from many clients concurrently.
- A single disk silently corrupting a few bytes (bit rot) must be detectable, not silently served as if correct.`;

const REFERENCE_APPROACH = `The system splits cleanly into two layers: a metadata service mapping (bucket, key) to the set of physical locations holding that object's data, and a data-node fleet that stores the actual bytes — a GET first consults metadata, then fetches from the located data nodes, rather than one monolithic layer doing both. A large object is split into fixed-size chunks, each placed onto data nodes via consistent hashing so the placement scheme scales cleanly as nodes are added or removed. Durability — the entire headline promise of a system like this — comes from redundancy at the chunk level: either straightforward replication (each chunk copied to 3+ distinct nodes, simple but ~3x storage overhead) or erasure coding (a chunk's data is encoded into N data fragments plus M parity fragments spread across N+M nodes, such that any N of the N+M fragments reconstruct the original — the same durability as much higher replication factors at a fraction of the storage overhead, at the cost of more CPU to reconstruct on a node failure). Every chunk carries a checksum, verified on every read and periodically re-verified by a background scrubbing process, specifically to catch bit rot (silent, undetected disk corruption) before it's ever served to a client as if it were correct. Objects are treated as immutable: a PUT to an existing key creates a new version rather than mutating bytes in place, which is what lets an in-flight GET keep reading a consistent, complete version even while a concurrent overwrite is happening. A DELETE (or an overwrite that makes an old version unreferenced) marks the old chunks with a tombstone rather than synchronously erasing them from every replica — actual space reclamation happens via an asynchronous garbage-collection process, decoupling the fast, simple delete API from the slower, fleet-wide cleanup work.`;

export const OBJECT_STORAGE_SYSTEM: DesignProblem = {
  slug: 'design-s3-like-object-storage',
  track: 'hld',
  title: 'Design an S3-like Object Storage System',
  difficulty: 'Hard',
  statement: STATEMENT,
  rubric: OBJECT_STORAGE_SYSTEM_RUBRIC,
  referenceApproach: REFERENCE_APPROACH,
  hints: [
    'A disk can silently flip a few bits without failing outright (bit rot). How would this system ever notice, rather than serving corrupted bytes as if they were fine?',
    'Replicating every chunk 3x gives strong durability but 3x storage cost. What technique gets similar durability at much lower storage overhead, at the cost of more CPU on reconstruction?',
    'Split metadata (key -> location) from a data-node fleet storing chunked object data; use consistent hashing for placement, checksums for integrity, and either replication or erasure coding for durability; treat objects as immutable, garbage-collecting deleted data asynchronously.',
  ],
};
