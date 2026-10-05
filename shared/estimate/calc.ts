import { PRICING } from './pricing.ts';

/**
 * Deterministic back-of-envelope capacity math — the calculations you're expected
 * to do out loud in the estimation phase of an HLD interview, turning a stated
 * user count into QPS, storage, bandwidth, and a rough server/cost order of
 * magnitude. Pure functions, no I/O, so they're as testable as the rubric engine.
 */

export interface EstimateInput {
  /** Daily active users. */
  users: number;
  /** Read/request actions per user per day (drives QPS). */
  actionsPerUserPerDay: number;
  /** How much higher peak traffic runs than the daily average (e.g. 3 = 3x). */
  peakMultiplier: number;
  /** Average size of a request payload, in bytes. */
  avgRequestBytes: number;
  /** Average size of a response payload, in bytes. */
  avgResponseBytes: number;
  /** Writes (new objects/rows) per user per day, for the storage estimate. */
  writesPerUserPerDay: number;
  /** Average size of one written object, in bytes (e.g. an uploaded photo). */
  avgObjectBytes: number;
  /** How many days of writes are kept before the oldest data ages out. */
  retentionDays: number;
  /** How many copies of the data are kept (e.g. 3 for a primary + 2 replicas). */
  replicationFactor: number;
  /** How many requests one application server instance can sustain at peak. */
  qpsPerServer: number;
}

export interface EstimateResult {
  avgQps: number;
  peakQps: number;
  /** Peak ingress bandwidth, in megabytes/sec. */
  ingressMBps: number;
  /** Peak egress bandwidth, in megabytes/sec. */
  egressMBps: number;
  storageBytesTotal: number;
  storageGbTotal: number;
  serversNeeded: number;
  monthlyEgressGb: number;
  monthlyS3Cost: number;
  monthlyEgressCost: number;
  monthlyCdnCost: number;
  monthlyComputeCost: number;
  /** S3 storage + raw internet egress + compute — the CDN cost is shown separately as a usually-cheaper alternative to raw egress. */
  monthlyTotalCost: number;
}

const SECONDS_PER_DAY = 86_400;
const DAYS_PER_MONTH = 30;
const BYTES_PER_GB = 1_000_000_000;
const BYTES_PER_MB = 1_000_000;

export function estimate(input: EstimateInput): EstimateResult {
  const avgQps = (input.users * input.actionsPerUserPerDay) / SECONDS_PER_DAY;
  const peakQps = avgQps * input.peakMultiplier;

  const ingressMBps = (peakQps * input.avgRequestBytes) / BYTES_PER_MB;
  const egressMBps = (peakQps * input.avgResponseBytes) / BYTES_PER_MB;

  const dailyWrites = input.users * input.writesPerUserPerDay;
  const storageBytesTotal = dailyWrites * input.avgObjectBytes * input.retentionDays * input.replicationFactor;
  const storageGbTotal = storageBytesTotal / BYTES_PER_GB;

  const serversNeeded = Math.max(1, Math.ceil(peakQps / input.qpsPerServer));

  // Monthly transfer volume comes from the AVERAGE rate sustained over a month, not
  // the instantaneous peak (peak is a capacity requirement, not a sustained volume).
  const egressBytesPerDay = avgQps * input.avgResponseBytes * SECONDS_PER_DAY;
  const monthlyEgressGb = (egressBytesPerDay * DAYS_PER_MONTH) / BYTES_PER_GB;

  const monthlyS3Cost = storageGbTotal * PRICING.s3StandardPerGbMonth;
  const monthlyEgressCost = monthlyEgressGb * PRICING.s3EgressPerGb;
  const monthlyCdnCost = monthlyEgressGb * PRICING.cloudFrontEgressPerGb;
  const monthlyComputeCost = serversNeeded * PRICING.ec2MediumPerHour * 24 * DAYS_PER_MONTH;

  return {
    avgQps: round2(avgQps),
    peakQps: round2(peakQps),
    ingressMBps: round2(ingressMBps),
    egressMBps: round2(egressMBps),
    storageBytesTotal,
    storageGbTotal: round2(storageGbTotal),
    serversNeeded,
    monthlyEgressGb: round2(monthlyEgressGb),
    monthlyS3Cost: round2(monthlyS3Cost),
    monthlyEgressCost: round2(monthlyEgressCost),
    monthlyCdnCost: round2(monthlyCdnCost),
    monthlyComputeCost: round2(monthlyComputeCost),
    monthlyTotalCost: round2(monthlyS3Cost + monthlyEgressCost + monthlyComputeCost),
  };
}

/** The same estimate at several user-count levels, e.g. [1e6, 10e6, 100e6] to show 1M -> 100M scaling. */
export function scaleTable(base: EstimateInput, userLevels: number[]): { users: number; result: EstimateResult }[] {
  return userLevels.map((users) => ({ users, result: estimate({ ...base, users }) }));
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}
