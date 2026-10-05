import { allNodesLabeled, hasRole, keywordAnywhere, redundancyEvidence } from '../rubric/checks.ts';
import type { RubricSpec } from '../rubric/types.ts';
import type { DesignProblem } from '../types.ts';

/**
 * The Dropbox/Google Drive shape: object storage separated from a metadata
 * service, chunking for large-file delta sync, and an explicit conflict-
 * resolution story for offline concurrent edits.
 */

const OBJECT_STORAGE_KEYWORDS = ['s3', 'object storage', 'blob storage', 'minio'];
const CHUNKING_KEYWORDS = ['chunk', 'chunking', 'block-level', 'delta sync'];
const CONFLICT_KEYWORDS = ['conflict resolution', 'last-write-wins', 'version vector', 'merge conflict', 'conflicted copy'];

const FILE_SYNC_RUBRIC: RubricSpec = {
  id: 'design-a-file-sync-service',
  title: 'Design a File Storage & Sync Service — rubric',
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
      id: 'object-storage-named',
      label: 'Object storage is named for file content, separate from metadata',
      max: 3,
      run: (g) =>
        keywordAnywhere(g, OBJECT_STORAGE_KEYWORDS)
          ? { points: 3, verdict: 'pass', detail: 'Object storage is named for file content.' }
          : { points: 0, verdict: 'fail', detail: 'Name where the actual file bytes live (S3/object/blob storage) — a relational database is the wrong place to store multi-gigabyte file content.' },
    },
    {
      id: 'chunking-named',
      label: 'Chunking / delta sync for large files is named',
      max: 3,
      run: (g) =>
        keywordAnywhere(g, CHUNKING_KEYWORDS)
          ? { points: 3, verdict: 'pass', detail: 'Chunking/delta sync is named.' }
          : {
              points: 0,
              verdict: 'fail',
              detail: 'Say how a small edit to a large file avoids re-uploading the whole file (fixed-size chunking with delta sync of only the changed blocks).',
            },
    },
    {
      id: 'metadata-datastore',
      label: 'A separate metadata datastore is present',
      max: 2,
      run: (g) =>
        hasRole(g, 'datastore')
          ? { points: 2, verdict: 'pass', detail: 'A metadata datastore is present.' }
          : { points: 0, verdict: 'fail', detail: 'No datastore drawn for the folder tree / file-to-chunk metadata.' },
    },
    {
      id: 'conflict-resolution',
      label: 'A conflict-resolution strategy for offline concurrent edits is named',
      max: 3,
      run: (g) =>
        keywordAnywhere(g, CONFLICT_KEYWORDS)
          ? { points: 3, verdict: 'pass', detail: 'A conflict-resolution strategy is named.' }
          : {
              points: 0,
              verdict: 'fail',
              detail: 'Name what happens when two devices edit the same file while both are offline (version vectors, or last-write-wins plus keeping a conflicted copy) — this is exactly what the prompt is testing.',
            },
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

const STATEMENT = `Design a cloud file storage and sync service (Dropbox/Google Drive-style): users upload files and folders, access them from multiple devices, and changes sync automatically across devices — including when two devices edit the same file while offline.

Functional requirements:
- Upload and download files and folders.
- Changes on one device sync automatically to a user's other devices.
- Share a file or folder with another user.
- Handle two devices editing the same file while both were offline.

Non-functional requirements / scale:
- Files ranging up to several gigabytes.
- Millions of users.
- Sync should feel near-real-time for small changes.`;

const REFERENCE_APPROACH = `File content is uploaded to object storage (S3-alikes), chunked into fixed-size blocks so that editing a large file only requires re-uploading the changed blocks (delta sync), not the whole file. A separate metadata service/datastore tracks the folder tree, each file's chunk list, and version history — kept apart from the bulky object storage because metadata is small, hot, and needs the kind of queries (list a folder, find a file's latest version) that a blob store doesn't do well. Each device syncs by polling or subscribing to metadata change notifications and then pulling only the chunks it's missing. When two devices edit the same file while both are offline, the conflict is detected via version vectors (or a simpler last-write-wins-plus-conflicted-copy approach, keeping both versions and letting the user reconcile — what Dropbox itself actually does) rather than silently discarding one edit. Redundancy across the load balancer, app tier, and datastore. The two things interviewers listen for: (1) chunking/delta sync named, since re-uploading whole files doesn't scale, and (2) an explicit conflict-resolution strategy, since the offline-edit scenario is the whole point of the prompt.`;

export const FILE_SYNC: DesignProblem = {
  slug: 'design-a-file-sync-service',
  track: 'hld',
  title: 'Design a File Storage & Sync Service',
  difficulty: 'Hard',
  statement: STATEMENT,
  rubric: FILE_SYNC_RUBRIC,
  referenceApproach: REFERENCE_APPROACH,
  hints: [
    'A user changes one byte of a 2GB video file. Does the whole file really need to re-upload?',
    'Two devices edit the same file while both are offline, then both come back online later. What actually happens to the second one that syncs?',
    'Chunk files into fixed-size blocks for delta sync (only re-upload changed blocks), and name an explicit conflict-resolution strategy — version vectors, or last-write-wins plus keeping a conflicted copy — for the offline-edit case.',
  ],
};
