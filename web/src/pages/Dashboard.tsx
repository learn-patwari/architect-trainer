import type { CSSProperties } from 'react';
import { Link } from 'react-router';
import type { ProblemRow, Track } from '../../../shared/types.ts';
import { api, useLoad } from '../api.ts';
import { DifficultyTag, ErrorBox, Loading, Rating } from '../components.tsx';

export function Dashboard() {
  const { data, error, loading } = useLoad(api.state, []);

  if (loading) {
    return (
      <main className="page">
        <Loading label="Loading dashboard…" />
      </main>
    );
  }
  if (error || !data) {
    return (
      <main className="page">
        <ErrorBox message={error ?? 'Failed to load.'} />
      </main>
    );
  }

  return (
    <main className="page">
      <h1>Architect Trainer</h1>

      <div className="grid grid-3" style={{ marginBottom: '1.5rem' }}>
        {data.tracks.map((t) => (
          <div className="card" key={t.track}>
            <div className="stat-label">{t.track.toUpperCase()} rating</div>
            <div className="stat-value">
              <Rating rating={t.rating} tier={t.tier} />
            </div>
            <div className="tiny muted">
              {t.ratedAttempts} rated attempt{t.ratedAttempts === 1 ? '' : 's'}
            </div>
          </div>
        ))}
      </div>

      <ProblemTable title="HLD problems" track="hld" rows={data.hldProblems} />
      <ProblemTable title="LLD problems" track="lld" rows={data.lldProblems} style={{ marginTop: '1.5rem' }} />

      {data.recent.length > 0 && (
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <h2>Recent attempts</h2>
          <div className="stack">
            {data.recent.map((r, i) => (
              <div className="spread" key={i}>
                <span>
                  {r.title} <span className="tag">{r.track.toUpperCase()}</span>
                </span>
                <span className="mono">{r.percent}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="callout small" style={{ marginTop: '1.5rem' }}>
        Not sure where to start? <Link to="/study-plan">The study plan</Link> lays out what to study first.{' '}
        <Link to="/concepts">Design concepts</Link>, <Link to="/tools">the tools reference</Link>, and{' '}
        <Link to="/estimate">the capacity estimator</Link> are pure reading/reference material — no account, no
        scoring, just open them and read.
      </div>
    </main>
  );
}

function ProblemTable({
  title,
  track,
  rows,
  style,
}: {
  title: string;
  track: Track;
  rows: ProblemRow[];
  style?: CSSProperties;
}) {
  return (
    <div className="card" style={style}>
      <h2>{title}</h2>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Problem</th>
              <th>Difficulty</th>
              <th>Attempts</th>
              <th>Best</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.slug}>
                <td>{p.title}</td>
                <td>
                  <DifficultyTag difficulty={p.difficulty} />
                </td>
                <td>{p.attempts}</td>
                <td>{p.bestPercent == null ? '—' : `${p.bestPercent}%`}</td>
                <td>
                  <Link className="btn btn-sm" to={`/problems/${track}/${p.slug}`}>
                    {p.attempts > 0 ? 'Retry' : 'Start'}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
