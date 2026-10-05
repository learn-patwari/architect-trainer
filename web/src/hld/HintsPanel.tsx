import { useState } from 'react';
import type { Track } from '../../../shared/types.ts';
import { api } from '../api.ts';

interface Props {
  track: Track;
  slug: string;
  totalHints: number;
  initialRevealed: string[];
}

/** Up to 3 hints, revealed one at a time on request — each a bigger nudge than the last,
 *  short of the reference architecture. Revealed hints persist across reloads. */
export function HintsPanel({ track, slug, totalHints, initialRevealed }: Props) {
  const [revealed, setRevealed] = useState(initialRevealed);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestHint = async () => {
    setLoading(true);
    setError(null);
    try {
      const { revealedHints } = await api.requestHint(track, slug);
      setRevealed(revealedHints);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const allRevealed = revealed.length >= totalHints;

  return (
    <div className="stack">
      <div className="spread">
        <h3 style={{ margin: 0 }}>Hints</h3>
        <span className="tiny muted">
          {revealed.length} of {totalHints} revealed
        </span>
      </div>
      {revealed.length === 0 && <p className="small muted" style={{ margin: 0 }}>Stuck? Each hint is a bigger nudge than the last — none of them give away the full approach.</p>}
      {revealed.map((hint, i) => (
        <div className="callout small" key={i}>
          <strong>Hint {i + 1}:</strong> {hint}
        </div>
      ))}
      {error && <p className="small" style={{ color: 'var(--bad)', margin: 0 }}>{error}</p>}
      {!allRevealed && (
        <button className="btn btn-sm" onClick={requestHint} disabled={loading}>
          {loading ? 'Loading…' : `Request hint ${revealed.length + 1} of ${totalHints}`}
        </button>
      )}
    </div>
  );
}
