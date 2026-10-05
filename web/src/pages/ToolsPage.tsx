import { useState } from 'react';
import { CATEGORY_LABELS, TOOLS, type ToolCategory } from '../../../shared/tools/index.ts';

const CATEGORIES = Object.keys(CATEGORY_LABELS) as ToolCategory[];

export function ToolsPage() {
  const [filter, setFilter] = useState<ToolCategory | 'all'>('all');
  const shown = filter === 'all' ? TOOLS : TOOLS.filter((t) => t.category === filter);

  return (
    <main className="page">
      <h1>Tools reference</h1>
      <p className="muted">
        The major open-source building blocks that show up on a whiteboard, with an honest pros/cons and one
        concrete "use it when" example each — not a feature matrix.
      </p>

      <div className="chips" style={{ margin: '1rem 0 1.5rem' }}>
        <button className={`chip ${filter === 'all' ? 'selected' : ''}`} onClick={() => setFilter('all')}>
          All ({TOOLS.length})
        </button>
        {CATEGORIES.map((cat) => (
          <button key={cat} className={`chip ${filter === cat ? 'selected' : ''}`} onClick={() => setFilter(cat)}>
            {CATEGORY_LABELS[cat]} ({TOOLS.filter((t) => t.category === cat).length})
          </button>
        ))}
      </div>

      <div className="grid grid-3">
        {shown.map((t) => (
          <div className="card" key={t.slug}>
            <div className="spread" style={{ marginBottom: '0.4rem' }}>
              <h3 style={{ margin: 0 }}>{t.name}</h3>
              <span className="tag">{CATEGORY_LABELS[t.category]}</span>
            </div>
            <p className="small">{t.whatItIs}</p>

            <div className="ref-h">Good at</div>
            <ul style={{ margin: '0 0 0.6rem', paddingLeft: '1.1rem' }} className="small">
              {t.goodAt.map((g, i) => (
                <li key={i}>{g}</li>
              ))}
            </ul>

            <div className="ref-h">Bad at</div>
            <ul style={{ margin: '0 0 0.6rem', paddingLeft: '1.1rem' }} className="small">
              {t.badAt.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>

            <div className="ref-h">Operational cost</div>
            <p className="small" style={{ marginBottom: '0.6rem' }}>
              {t.operationalCost}
            </p>

            <div className="callout small">
              <strong>Use it when:</strong> {t.useWhen}
            </div>
            <div className="callout small callout-example" style={{ marginTop: '0.5rem' }}>
              <strong>In the real world:</strong> {t.realWorldExample}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
