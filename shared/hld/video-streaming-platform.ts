import { allNodesLabeled, hasRole, keywordAnywhere, pathExists, redundancyEvidence } from '../rubric/checks.ts';
import type { RubricSpec } from '../rubric/types.ts';
import type { DesignProblem } from '../types.ts';

/**
 * The YouTube-shaped problem: the crux is the asynchronous transcoding
 * pipeline (upload succeeds long before a video is watchable) and serving
 * playback through a CDN, not the metadata CRUD around it.
 */

const OBJECT_STORAGE_KEYWORDS = ['s3', 'object storage', 'blob storage'];
const TRANSCODING_KEYWORDS = ['transcod', 'encode', 'encoding pipeline', 'ffmpeg'];
const ASYNC_KEYWORDS = ['async', 'queue', 'kafka', 'processing pipeline'];
const RESOLUTION_KEYWORDS = ['multiple resolutions', 'bitrate', 'adaptive bitrate', 'abr', '1080p', '720p', 'dash', 'hls'];
const CDN_KEYWORDS = ['cdn', 'edge'];
const METADATA_KEYWORDS = ['metadata', 'video id', 'thumbnail'];

const VIDEO_STREAMING_RUBRIC: RubricSpec = {
  id: 'design-youtube',
  title: 'Design YouTube — rubric',
  checks: [
    {
      id: 'upload-to-storage',
      label: 'Uploads land in object storage, not a database',
      max: 2,
      run: (g) =>
        keywordAnywhere(g, OBJECT_STORAGE_KEYWORDS)
          ? { points: 2, verdict: 'pass', detail: 'Object storage is named for raw video.' }
          : { points: 0, verdict: 'fail', detail: 'A raw video file belongs in object storage (S3-like), not a relational database — name it.' },
    },
    {
      id: 'async-transcoding',
      label: 'Transcoding happens asynchronously, off the upload\'s critical path',
      max: 3,
      run: (g) =>
        keywordAnywhere(g, TRANSCODING_KEYWORDS) && (keywordAnywhere(g, ASYNC_KEYWORDS) || hasRole(g, 'queue'))
          ? { points: 3, verdict: 'pass', detail: 'Async transcoding is named.' }
          : {
              points: 0,
              verdict: 'fail',
              detail: 'Transcoding a video takes real time — it must happen asynchronously (queued, processed by a separate worker fleet) after the upload already succeeded, not synchronously inside the upload request.',
            },
    },
    {
      id: 'multiple-resolutions',
      label: 'Multiple resolutions/bitrates are produced for adaptive playback',
      max: 3,
      run: (g) =>
        keywordAnywhere(g, RESOLUTION_KEYWORDS)
          ? { points: 3, verdict: 'pass', detail: 'Multiple resolutions/adaptive bitrate is named.' }
          : { points: 0, verdict: 'fail', detail: 'One resolution can\'t serve both a phone on 3G and a desktop on fiber — name multiple output resolutions/bitrates (adaptive bitrate streaming).' },
    },
    {
      id: 'cdn-for-playback',
      label: 'Playback is served through a CDN',
      max: 3,
      run: (g) =>
        hasRole(g, 'cdn') || keywordAnywhere(g, CDN_KEYWORDS)
          ? { points: 3, verdict: 'pass', detail: 'A CDN is named for playback.' }
          : { points: 0, verdict: 'fail', detail: 'Video is read-heavy, large, and rarely changes once encoded — the textbook CDN case. Serve playback through one.' },
    },
    {
      id: 'metadata-service',
      label: 'A separate metadata store/service exists (video title, owner, status)',
      max: 2,
      run: (g) =>
        keywordAnywhere(g, METADATA_KEYWORDS) || hasRole(g, 'datastore')
          ? { points: 2, verdict: 'pass', detail: 'A metadata store is present.' }
          : { points: 0, verdict: 'fail', detail: 'Metadata (title, owner, processing status, view count) is small, structured, and queried differently from the video bytes — give it its own store.' },
    },
    {
      id: 'lb-in-front',
      label: 'A load balancer sits in front of the app/upload tier',
      max: 2,
      run: (g) =>
        pathExists(g, 'client', 'loadBalancer') && pathExists(g, 'loadBalancer', 'appServer')
          ? { points: 2, verdict: 'pass', detail: 'Client -> load balancer -> app tier.' }
          : { points: 0, verdict: 'fail', detail: 'Route uploads/API traffic through a load balancer to the app tier.' },
    },
    {
      id: 'app-tier-redundant',
      label: 'The app tier has more than one instance',
      max: 1,
      run: (g) =>
        redundancyEvidence(g, 'appServer')
          ? { points: 1, verdict: 'pass', detail: 'The app tier is shown as more than one instance.' }
          : { points: 0, verdict: 'fail', detail: 'Show the app tier as more than one instance.' },
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

const STATEMENT = `Design a video-sharing platform (like YouTube): users upload videos, the platform processes them into a watchable form, and other users stream them back.

Functional requirements:
- Upload a video file; it becomes watchable within minutes, not instantly.
- Playback adapts to the viewer's connection (a phone on cellular vs. a desktop on fiber).
- Video metadata (title, description, view count, processing status) is queryable independently of the video bytes.

Non-functional requirements / scale:
- Read-heavy by orders of magnitude: far more views than uploads.
- Large binary payloads (videos can be gigabytes) alongside small, frequently-updated metadata (view counts).
- A newly uploaded video should be watchable without the uploader waiting for the full processing pipeline synchronously.`;

const REFERENCE_APPROACH = `An upload goes to object storage (S3-like) as the raw file, and the upload request returns as soon as that's durably stored — it does NOT wait for processing. A message is enqueued to kick off an asynchronous transcoding pipeline, run by a separate worker fleet, that produces multiple resolutions/bitrates (e.g. 360p/480p/720p/1080p) packaged for adaptive bitrate streaming (HLS/DASH), so a player can switch quality seamlessly as the viewer's bandwidth changes. Each encoded output also lands in object storage, and once encoding finishes, the video's metadata record (in a separate database from the video bytes) flips from "processing" to "ready." Playback itself is served through a CDN in front of the encoded segments — video is about as read-heavy and cacheable as content gets, so nearly all playback traffic should hit an edge cache, not origin storage directly. View counts and other frequently-updated, low-value-per-write metadata are typically batched/aggregated asynchronously (not incremented synchronously on every view) to avoid a hot-row write bottleneck on popular videos. The upload/API path itself sits behind a load balancer fronting a horizontally-scaled app tier, kept separate from the CPU-heavy transcoding workers so a burst of uploads doesn't starve ordinary API traffic.`;

export const VIDEO_STREAMING_PLATFORM: DesignProblem = {
  slug: 'design-youtube',
  track: 'hld',
  title: 'Design YouTube',
  difficulty: 'Hard',
  statement: STATEMENT,
  rubric: VIDEO_STREAMING_RUBRIC,
  referenceApproach: REFERENCE_APPROACH,
  hints: [
    'Transcoding a video into multiple resolutions can take minutes. Should the upload request wait for that to finish before returning?',
    'A viewer on a phone on cellular and a viewer on a desktop on fiber are watching the same video. Should they get the exact same file?',
    'Store the raw upload in object storage, kick off async transcoding into multiple resolutions for adaptive bitrate playback, and serve the encoded output through a CDN — with metadata in a separate store from the video bytes.',
  ],
};
