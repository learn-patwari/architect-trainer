import { Link, useParams } from 'react-router';
import { CATEGORY_LABELS, CONCEPTS, getConcept } from '../../../shared/concepts/index.ts';

export function ConceptDetailPage() {
  const { slug = '' } = useParams();
  const concept = getConcept(slug);

  if (!concept) {
    return (
      <main className="page">
        <div className="card empty">
          Unknown concept. <Link to="/concepts">Back to concepts</Link>
        </div>
      </main>
    );
  }

  const idx = CONCEPTS.findIndex((c) => c.slug === slug);
  const prev = idx > 0 ? CONCEPTS[idx - 1] : null;
  const next = idx < CONCEPTS.length - 1 ? CONCEPTS[idx + 1] : null;

  return (
    <main className="page">
      <div className="breadcrumb muted" style={{ marginBottom: '0.75rem' }}>
        <Link to="/concepts">Design concepts</Link> / {CATEGORY_LABELS[concept.category]}
      </div>

      <h1>{concept.title}</h1>
      <p className="muted" style={{ fontSize: '1.05rem' }}>
        {concept.summary}
      </p>

      <div className="card" style={{ marginTop: '1.25rem' }}>
        <div className="stack">
          {concept.explanation.split('\n\n').map((p, i) => (
            <p key={i} style={{ margin: 0 }}>
              {p}
            </p>
          ))}
        </div>
      </div>

      <div className="callout good" style={{ marginTop: '1rem' }}>
        <strong>Example:</strong> {concept.example}
      </div>

      {concept.codeExample && (
        <div className="card" style={{ marginTop: '1rem' }}>
          <h2 style={{ marginTop: 0 }}>In code</h2>
          <pre className="ref-code">
            <code>{concept.codeExample.code}</code>
          </pre>
        </div>
      )}

      <div className="callout" style={{ marginTop: '1rem' }}>
        <strong>In an interview:</strong> {concept.interviewCue}
      </div>

      <div className="card" style={{ marginTop: '1rem' }}>
        <h2 style={{ marginTop: 0 }}>Common pitfalls</h2>
        <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
          {concept.pitfalls.map((p, i) => (
            <li key={i} style={{ marginBottom: '0.4rem' }}>
              {p}
            </li>
          ))}
        </ul>
      </div>

      <div className="card" style={{ marginTop: '1rem' }}>
        <h2 style={{ marginTop: 0 }}>Read more</h2>
        <ul className="link-list">
          {concept.furtherReading.map((r) => (
            <li key={r.url}>
              <a href={r.url} target="_blank" rel="noreferrer">
                {r.label} ↗
              </a>
              <span className="url">{r.url}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="spread" style={{ marginTop: '1.5rem' }}>
        {prev ? (
          <Link className="btn btn-sm" to={`/concepts/${prev.slug}`}>
            ← {prev.title}
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link className="btn btn-sm" to={`/concepts/${next.slug}`}>
            {next.title} →
          </Link>
        ) : (
          <span />
        )}
      </div>
    </main>
  );
}
