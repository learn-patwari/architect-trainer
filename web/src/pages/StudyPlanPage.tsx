import { Link } from 'react-router';
import { STUDY_PLAN, type StudyStep } from '../../../shared/study-plan/index.ts';
import type { DashboardState } from '../../../shared/types.ts';
import { api, useLoad } from '../api.ts';
import { ErrorBox, Loading } from '../components.tsx';

const KIND_LABEL: Record<StudyStep['kind'], string> = {
  concept: 'Read',
  tools: 'Read',
  estimate: 'Use',
  problem: 'Practice',
  practice: 'Do',
};

function attemptsFor(data: DashboardState, step: StudyStep): number | null {
  if (step.kind !== 'problem' || !step.track || !step.slug) return null;
  const rows = step.track === 'hld' ? data.hldProblems : data.lldProblems;
  return rows.find((r) => r.slug === step.slug)?.attempts ?? 0;
}

export function StudyPlanPage() {
  const { data, error, loading } = useLoad(api.state, []);

  if (loading) {
    return (
      <main className="page">
        <Loading label="Loading study plan…" />
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

  const totalProblems = STUDY_PLAN.flatMap((p) => p.steps).filter((s) => s.kind === 'problem').length;
  const doneProblems = STUDY_PLAN.flatMap((p) => p.steps).filter((s) => (attemptsFor(data, s) ?? 0) > 0).length;

  return (
    <main className="page">
      <h1>Study plan</h1>
      <p className="muted">
        What to study first, in the order most prep guides converge on: foundations before building blocks, building
        blocks before practice, easy problems before hard ones, and hard problems before a timed mock round. Every
        step links to something already in this app — nothing here is new content, just a recommended order to work
        through it. {totalProblems > 0 && (
          <>
            You've practiced <strong>{doneProblems}</strong> of <strong>{totalProblems}</strong> problems on this plan.
          </>
        )}
      </p>

      <div className="stack" style={{ gap: '1.5rem', marginTop: '1.5rem' }}>
        {STUDY_PLAN.map((phase) => (
          <div className="card" key={phase.id}>
            <h2 style={{ marginBottom: '0.35rem' }}>{phase.title}</h2>
            <p className="small muted" style={{ marginBottom: '1rem' }}>
              {phase.blurb}
            </p>
            <div className="stack" style={{ gap: '0.6rem' }}>
              {phase.steps.map((step) => {
                const attempts = attemptsFor(data, step);
                const done = (attempts ?? 0) > 0;
                return (
                  <div className={`study-step${done ? ' study-step-done' : ''}`} key={step.id}>
                    <span className="study-step-mark" aria-hidden>
                      {done ? '✓' : '○'}
                    </span>
                    <div className="study-step-body">
                      <div className="spread">
                        <span className="study-step-title">{step.title}</span>
                        <span className="tag">{KIND_LABEL[step.kind]}</span>
                      </div>
                      <p className="small muted" style={{ margin: '0.15rem 0 0' }}>
                        {step.detail}
                      </p>
                    </div>
                    <Link className="btn btn-sm" to={step.href}>
                      {step.kind === 'problem' ? (done ? 'Retry' : 'Start') : 'Open'}
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
