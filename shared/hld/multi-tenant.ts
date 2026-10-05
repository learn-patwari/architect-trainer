import { allNodesLabeled, hasRole, keywordAnywhere, pathExists, redundancyEvidence } from '../rubric/checks.ts';
import type { RubricSpec } from '../rubric/types.ts';
import type { DesignProblem } from '../types.ts';

/**
 * A B2B SaaS problem: the interesting decisions are the data-isolation model
 * and the noisy-neighbor mitigation, not raw throughput. Reuses every existing
 * primitive plus keyword checks for the two SaaS-specific concerns.
 */

const TENANT_ID_KEYWORDS = ['tenant id', 'tenant_id', 'subdomain', 'tenant header', 'jwt claim'];
const ISOLATION_MODEL_KEYWORDS = ['tenant_id column', 'row-level security', 'schema per tenant', 'database per tenant', 'pool model', 'silo model', 'bridge model'];
const NOISY_NEIGHBOR_KEYWORDS = ['noisy neighbor', 'per-tenant rate limit', 'per-tenant quota', 'dedicated tenant', 'whale tenant'];

const MULTI_TENANT_RUBRIC: RubricSpec = {
  id: 'design-a-multi-tenant-saas-platform',
  title: 'Design a Multi-Tenant SaaS Platform — rubric',
  checks: [
    {
      id: 'load-balancer',
      label: 'Load balancer in front of the app tier',
      max: 3,
      run: (g) =>
        pathExists(g, 'loadBalancer', 'appServer')
          ? { points: 3, verdict: 'pass', detail: 'A load balancer sits in front of the app tier.' }
          : hasRole(g, 'loadBalancer')
            ? { points: 1, verdict: 'partial', detail: 'A load balancer is drawn but has no path into the app tier.' }
            : { points: 0, verdict: 'fail', detail: 'No load balancer in front of the app tier.' },
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
      id: 'tenant-identification',
      label: 'How a request identifies its tenant is named',
      max: 2,
      run: (g) =>
        keywordAnywhere(g, TENANT_ID_KEYWORDS)
          ? { points: 2, verdict: 'pass', detail: 'A tenant-identification mechanism is named.' }
          : { points: 0, verdict: 'fail', detail: 'Say how a request is tied to a tenant (a subdomain, a header, a JWT claim) — every downstream isolation decision depends on this being resolved early.' },
    },
    {
      id: 'isolation-model',
      label: 'A specific data-isolation model is named (siloed / pooled / bridge)',
      max: 3,
      run: (g) =>
        keywordAnywhere(g, ISOLATION_MODEL_KEYWORDS)
          ? { points: 3, verdict: 'pass', detail: 'A specific isolation model is named.' }
          : {
              points: 0,
              verdict: 'fail',
              detail: 'Name the actual isolation model: a database per tenant (siloed, strongest isolation, most ops), a shared database with a tenant_id column plus row-level security (pooled, cheapest, a single bug can leak across tenants), or schema-per-tenant — "tenants are isolated" alone says nothing.',
            },
    },
    {
      id: 'noisy-neighbor',
      label: 'Noisy-neighbor mitigation is named',
      max: 3,
      run: (g) =>
        keywordAnywhere(g, NOISY_NEIGHBOR_KEYWORDS)
          ? { points: 3, verdict: 'pass', detail: 'Noisy-neighbor mitigation is named.' }
          : {
              points: 0,
              verdict: 'fail',
              detail: 'Say what stops one huge tenant\'s traffic from degrading service for everyone else — per-tenant rate limits/quotas, or dedicated infrastructure for the largest ("whale") tenants. The prompt\'s "wildly different sizes" detail exists specifically to test for this.',
            },
    },
    {
      id: 'datastore-present',
      label: 'A datastore is present',
      max: 2,
      run: (g) =>
        hasRole(g, 'datastore')
          ? { points: 2, verdict: 'pass', detail: 'A datastore is present.' }
          : { points: 0, verdict: 'fail', detail: 'No datastore drawn.' },
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

const STATEMENT = `Design the backend for a B2B SaaS product used by many independent customer organizations ("tenants"). Each tenant's data must be strictly isolated from every other tenant's, and the platform bills per-tenant based on usage.

Functional requirements:
- Onboard a new tenant.
- Serve every request scoped to exactly one tenant.
- Enforce strict data isolation between tenants.
- Track usage per tenant for billing.

Non-functional requirements / scale:
- Thousands of tenants; most are small, a handful are very large ("whale" tenants).
- A single tenant's traffic spike must not degrade service for other tenants (the noisy-neighbor problem).`;

const REFERENCE_APPROACH = `Every request identifies its tenant early — a subdomain (acme.product.com), a header, or a JWT claim — and that tenant ID scopes every downstream query. Data isolation follows one of three standard models: siloed (a separate database per tenant — strongest isolation, most operational overhead, right for large or regulated tenants), pooled (one shared database, every table carries a tenant_id column with row-level security enforcing it — cheapest to run, but a single missed WHERE clause or RLS gap can leak data across tenants), or a bridge (shared infrastructure with schema-per-tenant). Mixing models by tenant size — silo the whales, pool everyone else — is common and defensible, and worth saying explicitly. The noisy-neighbor problem is handled with per-tenant rate limits/quotas enforced at the app tier, and/or physically isolating the largest tenants onto dedicated infrastructure so their load can't starve smaller tenants sharing the pool. Redundancy: multiple load balancer and app-tier instances; the datastore replicated per whichever isolation model was chosen. The two things interviewers listen for: (1) a specific isolation model named with its real trade-off, not "tenants are isolated," and (2) an explicit noisy-neighbor mitigation, since "thousands of tenants, wildly different sizes" is the whole point of the prompt.`;

export const MULTI_TENANT: DesignProblem = {
  slug: 'design-a-multi-tenant-saas-platform',
  track: 'hld',
  title: 'Design a Multi-Tenant SaaS Platform',
  difficulty: 'Hard',
  statement: STATEMENT,
  rubric: MULTI_TENANT_RUBRIC,
  referenceApproach: REFERENCE_APPROACH,
  hints: [
    'Before you can isolate anything, how does an incoming request even know which tenant it belongs to?',
    'A shared database with a tenant_id column is cheap to run — what\'s the actual risk of that model if you get it slightly wrong?',
    'Identify the tenant early (subdomain, header, or JWT claim), pick and name an explicit isolation model (siloed / pooled / schema-per-tenant), and add per-tenant rate limits so one whale tenant can\'t degrade everyone else.',
  ],
};
