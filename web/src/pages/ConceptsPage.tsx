import { Link } from 'react-router';
import { CATEGORY_LABELS, CONCEPTS, type ConceptCategory } from '../../../shared/concepts/index.ts';

const CATEGORIES = Object.keys(CATEGORY_LABELS) as ConceptCategory[];

export function ConceptsPage() {
  return (
    <main className="page">
      <h1>Design concepts</h1>
      <p className="muted">
        The vocabulary you're expected to have going in — not a full course, but enough to recognize when each idea
        applies, name it out loud instead of talking around it, and point to a real system that does it.
      </p>

      <div className="stack" style={{ gap: '1.75rem', marginTop: '1.5rem' }}>
        {CATEGORIES.map((cat) => (
          <section key={cat}>
            <h2 className="ref-h">{CATEGORY_LABELS[cat]}</h2>
            <div className="grid grid-3">
              {CONCEPTS.filter((c) => c.category === cat).map((c) => (
                <Link className="card card-link" to={`/concepts/${c.slug}`} key={c.slug}>
                  <h3 style={{ margin: '0 0 0.4rem' }}>{c.title}</h3>
                  <p className="small muted" style={{ margin: 0 }}>
                    {c.summary}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
