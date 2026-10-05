import type { EstimateInput } from './calc.ts';

/**
 * Reference scenarios for the capacity estimator — so it's not just a blank form
 * you have to guess plausible numbers for. Each one is either grounded in a real,
 * documented system (Instagram's own 2012 engineering blog, this app's own URL
 * shortener problem) or clearly labeled as an illustrative order of magnitude
 * rather than a specific company's live, frequently-changing published figures.
 */

export interface EstimateScenario {
  id: string;
  label: string;
  description: string;
  input: EstimateInput;
}

export const ESTIMATE_SCENARIOS: EstimateScenario[] = [
  {
    id: 'startup',
    label: 'Early-stage startup',
    description: 'A new product with real usage but no scale problems yet — most week-one production systems look roughly like this.',
    input: {
      users: 10_000,
      actionsPerUserPerDay: 5,
      peakMultiplier: 2,
      avgRequestBytes: 500,
      avgResponseBytes: 2_000,
      writesPerUserPerDay: 1,
      avgObjectBytes: 500_000,
      retentionDays: 365,
      replicationFactor: 2,
      qpsPerServer: 500,
    },
  },
  {
    id: 'url-shortener',
    label: 'URL shortener, Bit.ly scale',
    description: 'Matches this app\'s own "Design a URL Shortener" problem: ~100M new links a month, with redirects (reads) outnumbering new links (writes) roughly 100:1.',
    input: {
      users: 30_000_000,
      actionsPerUserPerDay: 4,
      peakMultiplier: 3,
      avgRequestBytes: 200,
      avgResponseBytes: 300,
      writesPerUserPerDay: 0.11,
      avgObjectBytes: 500,
      retentionDays: 1_825,
      replicationFactor: 3,
      qpsPerServer: 800,
    },
  },
  {
    id: 'instagram-2012',
    label: 'Instagram, 2012 (early sharded-Postgres era)',
    description:
      'Instagram\'s own engineering blog ("Sharding & IDs at Instagram") describes roughly this scale — tens of millions of users and a couple thousand photos uploaded per second at peak — served off a handful of sharded PostgreSQL boxes, well before their later hyper-growth. Real proof a scrappy setup can hold real scale.',
    input: {
      users: 30_000_000,
      actionsPerUserPerDay: 6,
      peakMultiplier: 3,
      avgRequestBytes: 300,
      avgResponseBytes: 4_000,
      writesPerUserPerDay: 0.3,
      avgObjectBytes: 2_000_000,
      retentionDays: 3_650,
      replicationFactor: 3,
      qpsPerServer: 300,
    },
  },
  {
    id: 'hyperscale-messaging',
    label: 'Global-scale messaging platform',
    description:
      'Illustrative only — an order-of-magnitude example for when a design needs to survive true global scale (hundreds of millions of users, tens of messages per user per day), not any specific company\'s live, frequently-changing published numbers.',
    input: {
      users: 500_000_000,
      actionsPerUserPerDay: 40,
      peakMultiplier: 4,
      avgRequestBytes: 300,
      avgResponseBytes: 300,
      writesPerUserPerDay: 20,
      avgObjectBytes: 2_000,
      retentionDays: 90,
      replicationFactor: 3,
      qpsPerServer: 1_000,
    },
  },
];
