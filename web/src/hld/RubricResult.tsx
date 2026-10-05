import type { RubricCheckResult } from '../../../shared/rubric/types.ts';
import { ScoreRing } from '../components.tsx';

const VERDICT_CLASS: Record<string, string> = { pass: 'v-correct', partial: 'v-partial', fail: 'v-wrong', na: 'v-skipped' };
const VERDICT_ICON: Record<string, string> = { pass: '✓', partial: '½', fail: '✗', na: '–' };

export function RubricResult({
  score,
  maxScore,
  percent,
  breakdown,
}: {
  score: number;
  maxScore: number;
  percent: number;
  breakdown: RubricCheckResult[];
}) {
  return (
    <div className="stack">
      <div className="row" style={{ gap: '1rem' }}>
        <ScoreRing percent={percent} />
        <div>
          <div className="stat-value">
            {score} / {maxScore}
          </div>
          <div className="stat-label">Rubric score</div>
        </div>
      </div>
      <div>
        {breakdown.map((c) => (
          <div className="verdict" key={c.id}>
            <span className={`verdict-icon ${VERDICT_CLASS[c.verdict]}`}>{VERDICT_ICON[c.verdict]}</span>
            <div>
              <div className="spread">
                <strong>{c.label}</strong>
                <span className="tiny muted">
                  {c.points}/{c.max}
                </span>
              </div>
              <div className="small muted">{c.detail}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
