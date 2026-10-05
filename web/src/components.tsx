import type { Difficulty, Tier } from '../../shared/types.ts';

export function DifficultyTag({ difficulty }: { difficulty: Difficulty }) {
  return <span className={`tag tag-${difficulty}`}>{difficulty}</span>;
}

export function TierLabel({ tier }: { tier: Tier }) {
  return <span className={`tier tier-${tier.replace(' ', '-')}`}>{tier}</span>;
}

export function Rating({ rating, tier }: { rating: number | null; tier: Tier }) {
  return (
    <span className="row" style={{ gap: '0.4rem' }}>
      <strong className="mono">{rating ?? '—'}</strong>
      <TierLabel tier={tier} />
    </span>
  );
}

export function RatingDelta({ before, after }: { before: number; after: number }) {
  const d = after - before;
  if (d === 0) return <span className="muted">±0</span>;
  return <span className={d > 0 ? 'delta-up' : 'delta-down'}>{d > 0 ? `+${d}` : d}</span>;
}

export function ScoreRing({ percent }: { percent: number }) {
  const ring = percent >= 80 ? 'var(--good)' : percent >= 50 ? 'var(--warn)' : 'var(--bad)';
  return (
    <div className="score-ring" style={{ ['--p' as string]: percent, ['--ring' as string]: ring }} aria-label={`Score ${percent}%`}>
      <span>{percent}%</span>
    </div>
  );
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="empty">
      <span className="spinner" /> <span style={{ marginLeft: '0.5rem' }}>{label}</span>
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="callout bad" role="alert">
      <div className="spread">
        <span>{message}</span>
        {onRetry && (
          <button className="btn btn-sm" onClick={onRetry}>
            Retry
          </button>
        )}
      </div>
    </div>
  );
}

export function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}:${String(s).padStart(2, '0')}`;
}

export function timeAgo(iso: string): string {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}
