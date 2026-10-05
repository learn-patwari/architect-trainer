import express, { type NextFunction, type Request, type Response } from 'express';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildReviewPrompt } from '../shared/ai-prompt.ts';
import { describeScene } from '../shared/scene/describe.ts';
import { parseScene, type ExcalidrawElement } from '../shared/scene/excalidraw-graph.ts';
import type { AttemptResult, Difficulty, PhaseAnswers, Track } from '../shared/types.ts';
import { clearConfig, readConfig, requestReview, saveConfig, view as aiView } from './ai.ts';
import { readProgress, resetProgress, updateProgress } from './store.ts';
import {
  addPhaseTime,
  dashboard,
  HttpError,
  phaseAnalysis,
  problemView,
  recordAttempt,
  requireProblem,
  requireTrack,
  revealHint,
  saveAiReview,
  saveNotes,
  savePhaseState,
  savePhaseAnswer,
  saveScene,
} from './trainer.ts';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

export function createApp({ webDir = resolve('dist/web') } = {}) {
  const app = express();
  app.disable('x-powered-by');

  // Local-only app: refuse other Host headers (blocks DNS-rebinding), and require JSON on
  // writes so a random web page can't submit forms against the API.
  app.use((req, res, next) => {
    const host = (req.headers.host ?? '').replace(/:\d+$/, '');
    if (!LOCAL_HOSTS.has(host)) return res.status(403).json({ error: 'This server only accepts local requests.' });
    if (req.method !== 'GET' && req.method !== 'HEAD' && !req.is('application/json')) {
      return res.status(415).json({ error: 'Send JSON (Content-Type: application/json).' });
    }
    next();
  });
  // A scene JSON plus a base64 PNG screenshot can run a few MB.
  app.use(express.json({ limit: '8mb' }));

  const api = express.Router();

  api.get('/state', async (_req, res) => {
    res.json(dashboard(await readProgress()));
  });

  // One generic set of routes serves both HLD and LLD: they share the exact same
  // pipeline (scene -> graph -> rubric -> Elo -> AI review), just different content
  // and role vocabulary. `:track` is validated as 'hld' | 'lld' before anything else runs.
  api.get('/problems/:track/:slug', async (req, res) => {
    const track = requireTrack(req.params.track);
    res.json(problemView(await readProgress(), track, req.params.slug));
  });

  api.put('/problems/:track/:slug/scene', async (req, res) => {
    const track = requireTrack(req.params.track);
    const { scene } = (req.body ?? {}) as { scene?: unknown };
    await updateProgress((p) => saveScene(p, track, req.params.slug, scene));
    res.json({ ok: true });
  });

  api.put('/problems/:track/:slug/notes', async (req, res) => {
    const track = requireTrack(req.params.track);
    const { notes } = (req.body ?? {}) as { notes?: unknown };
    await updateProgress((p) => saveNotes(p, track, req.params.slug, notes));
    res.json({ ok: true });
  });

  /** One phase's written field — requirements, estimation, API design, data model, or trade-offs. */
  api.put('/problems/:track/:slug/phase-answer', async (req, res) => {
    const track = requireTrack(req.params.track);
    const { phase, text } = (req.body ?? {}) as { phase?: unknown; text?: unknown };
    await updateProgress((p) => savePhaseAnswer(p, track, req.params.slug, phase, text));
    res.json({ ok: true });
  });

  /** Current phase + reviewed phases (and optionally a time reset), so the wizard resumes after a reload/restart. */
  api.put('/problems/:track/:slug/phase-state', async (req, res) => {
    const track = requireTrack(req.params.track);
    await updateProgress((p) => savePhaseState(p, track, req.params.slug, req.body));
    res.json({ ok: true });
  });

  /** Reveals the next of this problem's 3 hints (if any remain) and returns every hint revealed so far. */
  api.post('/problems/:track/:slug/hint', async (req, res) => {
    const track = requireTrack(req.params.track);
    const revealedHints = await updateProgress((p) => revealHint(p, track, req.params.slug));
    res.json({ revealedHints });
  });

  /** Adds to the time banked against a problem's phases; the body is the delta since the last call. */
  api.post('/problems/:track/:slug/time', async (req, res) => {
    const track = requireTrack(req.params.track);
    res.json(await updateProgress((p) => addPhaseTime(p, track, req.params.slug, req.body)));
  });

  api.post('/problems/:track/:slug/score', async (req, res) => {
    const track = requireTrack(req.params.track);
    const { scene } = (req.body ?? {}) as { scene?: unknown };
    const result = await updateProgress((p) => recordAttempt(p, track, req.params.slug, scene));
    res.json({ ...result, phaseAnalysis: phaseAnalysis(result.phaseTimes) });
  });

  /**
   * Everything a model needs to review one attempt, as a ready-made prompt: works
   * with no API key at all — copy it into any chat window.
   */
  api.get('/problems/:track/:slug/ai-prompt', async (req, res) => {
    const track = requireTrack(req.params.track);
    const ctx = await reviewContext(track, req.params.slug, null);
    res.json({ prompt: buildReviewPrompt(ctx) });
  });

  /** The same prompt, posted to whichever model you configured, plus a screenshot when captured. */
  api.post('/problems/:track/:slug/ai-review', async (req, res) => {
    const track = requireTrack(req.params.track);
    const { imageBase64 } = (req.body ?? {}) as { imageBase64?: unknown };
    const image = typeof imageBase64 === 'string' && imageBase64.length > 0 ? imageBase64 : null;
    const ctx = await reviewContext(track, req.params.slug, image);
    const result = await requestReview({ ...ctx, imageBase64: image });
    await updateProgress((p) => saveAiReview(p, track, req.params.slug, { text: result.review, model: result.model, at: result.at }));
    res.json(result);
  });

  api.get('/ai/config', async (_req, res) => {
    res.json(aiView(await readConfig()));
  });

  api.put('/ai/config', async (req, res) => {
    res.json(await saveConfig(req.body));
  });

  api.delete('/ai/config', async (_req, res) => {
    await clearConfig();
    res.json(aiView(await readConfig()));
  });

  api.post('/reset', async (req, res) => {
    if ((req.body as { confirm?: unknown } | undefined)?.confirm !== 'RESET') {
      throw new HttpError(400, 'Send {"confirm":"RESET"} to erase your progress.');
    }
    await resetProgress();
    res.json({ ok: true });
  });

  api.use((_req, res) => {
    res.status(404).json({ error: 'Unknown API route.' });
  });

  app.use('/api', api);

  // Serve the built UI (npm start). In development Vite serves it instead.
  if (existsSync(join(webDir, 'index.html'))) {
    app.use(express.static(webDir));
    app.use((req, res, next) => {
      if (req.method === 'GET' && !req.path.startsWith('/api/')) res.sendFile('index.html', { root: webDir });
      else next();
    });
  }

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    const status = (err as { status?: number; statusCode?: number })?.status ?? (err as { statusCode?: number })?.statusCode;
    if (status && status >= 400 && status < 500) return res.status(status).json({ error: (err as Error).message || 'Bad request.' });
    console.error(err);
    res.status(500).json({ error: 'Something went wrong on the server; see its console for details.' });
  });

  return app;
}

interface ReviewContextOut {
  title: string;
  difficulty: Difficulty;
  statement: string;
  notes: string | null;
  phaseAnswers: PhaseAnswers | null;
  sceneDescription: string;
  attempt: AttemptResult | null;
  hasImage: boolean;
}

/** Gathers the problem, the candidate's work, and how it went, for an AI review. */
async function reviewContext(track: Track, slug: string, imageBase64: string | null): Promise<ReviewContextOut> {
  const problem = requireProblem(track, slug);
  const progress = (await readProgress())[track][slug] ?? null;
  const graph = parseScene(Array.isArray(progress?.scene) ? (progress!.scene as ExcalidrawElement[]) : []);
  return {
    title: problem.title,
    difficulty: problem.difficulty,
    statement: problem.statement,
    notes: progress?.notes ?? null,
    phaseAnswers: progress?.phaseAnswers ?? null,
    sceneDescription: describeScene(graph),
    attempt: progress?.lastResult ?? null,
    hasImage: imageBase64 != null,
  };
}
