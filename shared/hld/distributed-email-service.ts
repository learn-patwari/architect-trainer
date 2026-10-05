import { allNodesLabeled, hasRole, keywordAnywhere, pathExists, redundancyEvidence } from '../rubric/checks.ts';
import type { RubricSpec } from '../rubric/types.ts';
import type { DesignProblem } from '../types.ts';

/**
 * The Gmail-shaped problem: the crux is separating email metadata (indexed,
 * searched, queried constantly) from the raw message body/attachments
 * (large, immutable, read rarely), plus async, queue-based delivery for
 * outbound send — not real-time messaging (contrast with Chat System).
 */

const OBJECT_STORAGE_KEYWORDS = ['s3', 'object storage', 'blob storage'];
const METADATA_STORE_KEYWORDS = ['metadata', 'metadata store', 'metadata database'];
const SEARCH_INDEX_KEYWORDS = ['search index', 'elasticsearch', 'inverted index', 'full-text'];
const ASYNC_SEND_KEYWORDS = ['async', 'queue', 'send queue', 'outbound queue'];
const SPAM_KEYWORDS = ['spam filter', 'spam', 'antivirus'];
const RETRY_KEYWORDS = ['retry', 'bounce', 'dead letter', 'backoff'];
const LABEL_FOLDER_KEYWORDS = ['label', 'folder', 'many-to-many'];

const DISTRIBUTED_EMAIL_RUBRIC: RubricSpec = {
  id: 'design-a-distributed-email-service',
  title: 'Design a Distributed Email Service — rubric',
  checks: [
    {
      id: 'body-in-object-storage',
      label: 'Message bodies/attachments live in object storage, separate from metadata',
      max: 3,
      run: (g) =>
        keywordAnywhere(g, OBJECT_STORAGE_KEYWORDS)
          ? { points: 3, verdict: 'pass', detail: 'Object storage is named for message content.' }
          : { points: 0, verdict: 'fail', detail: 'A message body plus attachments is large and immutable once received — name object storage for it, separate from the metadata that gets queried constantly.' },
    },
    {
      id: 'metadata-store-separate',
      label: 'A separate metadata store holds sender/subject/labels/read-state',
      max: 2,
      run: (g) =>
        keywordAnywhere(g, METADATA_STORE_KEYWORDS) || hasRole(g, 'datastore')
          ? { points: 2, verdict: 'pass', detail: 'A metadata store is present.' }
          : { points: 0, verdict: 'fail', detail: 'Name the small, frequently-updated metadata (sender, subject, read/unread, labels) as its own store, separate from the large immutable body.' },
    },
    {
      id: 'search-index-named',
      label: 'A full-text search index powers mailbox search',
      max: 3,
      run: (g) =>
        keywordAnywhere(g, SEARCH_INDEX_KEYWORDS)
          ? { points: 3, verdict: 'pass', detail: 'A search index is named.' }
          : { points: 0, verdict: 'fail', detail: '"Search my inbox for X" isn\'t a database query on the metadata table — name a full-text search index (Elasticsearch or similar).' },
    },
    {
      id: 'labels-not-folders',
      label: 'Labels/tags are modeled as many-to-many, not single folders',
      max: 2,
      run: (g) =>
        keywordAnywhere(g, LABEL_FOLDER_KEYWORDS)
          ? { points: 2, verdict: 'pass', detail: 'Many-to-many labels are named.' }
          : { points: 0, verdict: 'fail', detail: 'An email can belong to multiple labels at once — model this as a many-to-many relationship, not a single folder column on the message.' },
    },
    {
      id: 'async-outbound-send',
      label: 'Outbound sending happens asynchronously through a queue',
      max: 3,
      run: (g) =>
        hasRole(g, 'queue') && keywordAnywhere(g, ASYNC_SEND_KEYWORDS)
          ? { points: 3, verdict: 'pass', detail: 'Async, queue-based sending is named.' }
          : {
              points: 0,
              verdict: 'fail',
              detail: '"Send" shouldn\'t make the sender\'s client wait for delivery to every recipient\'s mail server — enqueue the send and process it asynchronously, so the UI can confirm immediately.',
            },
    },
    {
      id: 'retry-bounce-handling',
      label: 'Delivery retry/bounce handling is named',
      max: 2,
      run: (g) =>
        keywordAnywhere(g, RETRY_KEYWORDS)
          ? { points: 2, verdict: 'pass', detail: 'Retry/bounce handling is named.' }
          : { points: 0, verdict: 'fail', detail: 'A recipient mail server can be temporarily unreachable — name a retry-with-backoff, and what happens to a message that never delivers (a bounce notice).' },
    },
    {
      id: 'spam-filtering',
      label: 'Inbound mail passes through spam/malware filtering',
      max: 2,
      run: (g) =>
        keywordAnywhere(g, SPAM_KEYWORDS)
          ? { points: 2, verdict: 'pass', detail: 'Spam/malware filtering is named.' }
          : { points: 0, verdict: 'fail', detail: 'Name where inbound mail is scanned for spam/malware before it reaches a mailbox.' },
    },
    {
      id: 'lb-in-front',
      label: 'A load balancer sits in front of the app tier',
      max: 1,
      run: (g) => (pathExists(g, 'client', 'loadBalancer') ? { points: 1, verdict: 'pass', detail: 'A load balancer is present.' } : { points: 0, verdict: 'fail', detail: 'Route the client through a load balancer to the app tier.' }),
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
      max: 1,
      run: (g) => {
        const { labeled, total } = allNodesLabeled(g);
        if (total === 0) return { points: 0, verdict: 'fail', detail: 'Nothing drawn yet.' };
        const points = Math.round((1 * labeled) / total);
        const verdict = labeled === total ? 'pass' : labeled === 0 ? 'fail' : 'partial';
        return { points, verdict, detail: labeled === total ? 'Every shape is labeled.' : `${total - labeled} shape(s) have no label.` };
      },
    },
  ],
};

const STATEMENT = `Design an email service (like Gmail): users send and receive email, search their mailbox, and organize messages with labels.

Functional requirements:
- Send an email to one or more recipients; the sender's client gets a fast confirmation without waiting for full delivery.
- Receive inbound email, scan it, and deliver it into the right mailbox.
- Search a mailbox by sender, subject, or body content; apply multiple labels to the same message.

Non-functional requirements / scale:
- Billions of messages, many with large attachments, stored essentially forever.
- Search needs to feel instant even over years of mail history.
- Delivery to an external mail server can fail or be delayed — the system must not lose a message because of that.`;

const REFERENCE_APPROACH = `A message's body and attachments are large, immutable once received, and read far less often than metadata is queried — they're stored in object storage, keyed by message ID. Everything queried constantly (sender, subject, timestamp, read/unread, which labels apply) lives in a separate, smaller metadata store, referencing the object-storage key rather than duplicating the body. Labels are modeled as a many-to-many relationship between messages and labels (a join table, or an array-of-label-IDs field), since Gmail-style labeling explicitly allows one message to carry several labels at once, unlike a single-folder model. Mailbox search is served by a full-text search index (Elasticsearch or similar) built over the metadata plus indexed message content, not by querying the metadata store directly, since "search my inbox for X" is a full-text problem the metadata store's schema isn't built for. Sending is asynchronous: the send request is validated and enqueued, and the sender's client gets a fast acknowledgment immediately — actual delivery (resolving the recipient's mail server, transmitting the message, handling that server being temporarily unreachable) happens in the background via a worker pool consuming the send queue, with retry-with-backoff for transient failures and a bounce notification back to the sender if delivery ultimately fails. Inbound mail passes through spam/malware filtering before it's committed to a recipient's mailbox, and the app tier handling both the web/API surface and the inbound-mail-receiving surface sits behind a load balancer, horizontally scaled.`;

export const DISTRIBUTED_EMAIL_SERVICE: DesignProblem = {
  slug: 'design-a-distributed-email-service',
  track: 'hld',
  title: 'Design a Distributed Email Service',
  difficulty: 'Hard',
  statement: STATEMENT,
  rubric: DISTRIBUTED_EMAIL_RUBRIC,
  referenceApproach: REFERENCE_APPROACH,
  hints: [
    'A message body with attachments can be megabytes; its metadata (sender, subject, read state) is tiny and queried constantly. Should they live in the same store?',
    'Should the sender\'s client wait for the message to actually reach every recipient\'s mail server before confirming "sent"?',
    'Store bodies/attachments in object storage separate from a metadata store, search via a full-text index, model labels as many-to-many, and send asynchronously through a queue with retry-with-backoff and bounce handling.',
  ],
};
