import { useEffect } from 'react';
import { Link, NavLink, Route, Routes, useLocation } from 'react-router';
import { ConceptDetailPage } from './pages/ConceptDetailPage.tsx';
import { ConceptsPage } from './pages/ConceptsPage.tsx';
import { Dashboard } from './pages/Dashboard.tsx';
import { EstimatePage } from './pages/EstimatePage.tsx';
import { ProblemPage } from './pages/ProblemPage.tsx';
import { StudyPlanPage } from './pages/StudyPlanPage.tsx';
import { ToolsPage } from './pages/ToolsPage.tsx';

export function App() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0); // may return a Promise in newer browsers; don't return it from the effect
  }, [pathname]);

  return (
    <>
      <header className="app-header">
        <Link to="/" className="brand">
          <span className="brand-mark" aria-hidden>
            AT
          </span>
          Architect Trainer
        </Link>
        <nav className="nav" aria-label="Main">
          <NavLink to="/" end>
            Dashboard
          </NavLink>
          <NavLink to="/study-plan">Study plan</NavLink>
          <NavLink to="/problems/hld/design-a-url-shortener">HLD</NavLink>
          <NavLink to="/problems/lld/design-a-parking-lot">LLD</NavLink>
          <NavLink to="/concepts">Concepts</NavLink>
          <NavLink to="/tools">Tools</NavLink>
          <NavLink to="/estimate">Estimate</NavLink>
        </nav>
      </header>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/study-plan" element={<StudyPlanPage />} />
        <Route path="/problems/:track/:slug" element={<ProblemPage />} />
        <Route path="/concepts" element={<ConceptsPage />} />
        <Route path="/concepts/:slug" element={<ConceptDetailPage />} />
        <Route path="/tools" element={<ToolsPage />} />
        <Route path="/estimate" element={<EstimatePage />} />
        <Route
          path="*"
          element={
            <main className="page">
              <div className="card empty">
                Nothing here. <Link to="/">Back to the dashboard</Link>
              </div>
            </main>
          }
        />
      </Routes>
    </>
  );
}
