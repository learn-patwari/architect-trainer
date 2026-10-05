/**
 * Ballpark, illustrative pricing — NOT a substitute for AWS's own pricing pages,
 * which change and vary by region/commitment/tier. These exist so the estimate
 * calculator can show a plausible order of magnitude, not an accurate bill.
 */
export const PRICING_NOTE =
  'Ballpark US-East, on-demand, no-commitment list prices, authored in 2026. Real prices vary by region, ' +
  'tier, and commitment — always check aws.amazon.com/pricing before using numbers like these for a real budget.';

export const PRICING = {
  /** S3 Standard, per GB stored per month. */
  s3StandardPerGbMonth: 0.023,
  /** S3 Standard, data transferred OUT to the internet, per GB (after the free tier). */
  s3EgressPerGb: 0.09,
  /** CloudFront, data transferred out, per GB (first ~10TB/month tier). */
  cloudFrontEgressPerGb: 0.085,
  /** A "medium" general-purpose EC2 instance (e.g. m6i.large-class), on-demand, per hour. */
  ec2MediumPerHour: 0.0416,
} as const;
