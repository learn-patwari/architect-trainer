import { describe, expect, it } from 'vitest';
import { estimate, scaleTable, type EstimateInput } from '../shared/estimate/calc.ts';
import { PRICING } from '../shared/estimate/pricing.ts';

const BASE: EstimateInput = {
  users: 1_000_000,
  actionsPerUserPerDay: 10,
  peakMultiplier: 3,
  avgRequestBytes: 500,
  avgResponseBytes: 2_000,
  writesPerUserPerDay: 1,
  avgObjectBytes: 1_000_000, // 1 MB
  retentionDays: 30,
  replicationFactor: 3,
  qpsPerServer: 500,
};

describe('estimate', () => {
  it('computes average and peak QPS from users and actions/day', () => {
    const r = estimate(BASE);
    // 1,000,000 users * 10 actions/day / 86,400 sec/day
    expect(r.avgQps).toBeCloseTo(115.74, 1);
    expect(r.peakQps).toBeCloseTo(115.74 * 3, 1);
  });

  it('computes storage as writes/day * object size * retention * replication', () => {
    const r = estimate(BASE);
    // 1,000,000 writes/day * 1,000,000 bytes * 30 days * 3 replicas = 9e13 bytes = 90,000 GB
    expect(r.storageBytesTotal).toBe(1_000_000 * 1 * 1_000_000 * 30 * 3);
    expect(r.storageGbTotal).toBeCloseTo(90_000, 0);
  });

  it('scales storage linearly with replication factor', () => {
    const r1 = estimate({ ...BASE, replicationFactor: 1 });
    const r3 = estimate({ ...BASE, replicationFactor: 3 });
    expect(r3.storageGbTotal).toBeCloseTo(r1.storageGbTotal * 3, 3);
  });

  it('computes servers needed as ceil(peakQps / qpsPerServer), minimum 1', () => {
    const r = estimate({ ...BASE, qpsPerServer: 100 });
    expect(r.serversNeeded).toBe(Math.ceil(r.peakQps / 100));
    const tiny = estimate({ ...BASE, users: 1, actionsPerUserPerDay: 1 });
    expect(tiny.serversNeeded).toBeGreaterThanOrEqual(1);
  });

  it('derives monthly egress cost and CDN cost from the same monthly egress volume', () => {
    const r = estimate(BASE);
    expect(r.monthlyEgressCost).toBeCloseTo(r.monthlyEgressGb * PRICING.s3EgressPerGb, 2);
    expect(r.monthlyCdnCost).toBeCloseTo(r.monthlyEgressGb * PRICING.cloudFrontEgressPerGb, 2);
    // CDN should be cheaper per GB than raw internet egress at this pricing.
    expect(r.monthlyCdnCost).toBeLessThan(r.monthlyEgressCost);
  });

  it('sums storage + egress + compute into monthlyTotalCost', () => {
    const r = estimate(BASE);
    expect(r.monthlyTotalCost).toBeCloseTo(r.monthlyS3Cost + r.monthlyEgressCost + r.monthlyComputeCost, 2);
  });

  it('produces a 1M -> 100M scaling table with proportionally larger results', () => {
    const table = scaleTable(BASE, [1_000_000, 10_000_000, 100_000_000]);
    expect(table).toHaveLength(3);
    expect(table[1]!.result.avgQps).toBeCloseTo(table[0]!.result.avgQps * 10, 1);
    expect(table[2]!.result.storageGbTotal).toBeCloseTo(table[0]!.result.storageGbTotal * 100, 0);
  });
});
