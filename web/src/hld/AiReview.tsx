import { useState } from 'react';
import type { Track } from '../../../shared/types.ts';
import { api, useLoad } from '../api.ts';
import { ErrorBox, Loading } from '../components.tsx';

/**
 * Two ways to get a review, mirroring the DSA trainer's AiReview.tsx: copy the
 * prompt into whatever chat you already pay for, or have the server send it to a
 * model you configured. A copied prompt can't carry an image, so a Download PNG
 * button sits next to it — paste both into the chat. Shared by both HLD and LLD
 * problem pages; `track` just picks which API path it talks to.
 */
export function AiReview({
  track,
  slug,
  hasAttempt,
  captureImage,
  initialReview = null,
}: {
  track: Track;
  slug: string;
  hasAttempt: boolean;
  captureImage: () => Promise<string | null>;
  /** The last review you received (saved server-side), so a reload doesn't throw away a paid API call. */
  initialReview?: string | null;
}) {
  const cfg = useLoad(api.aiConfig, []);
  const [prompt, setPrompt] = useState<string | null>(null);
  const [review, setReview] = useState<string | null>(initialReview);
  const [busy, setBusy] = useState<'prompt' | 'review' | 'image' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = async () => {
    setBusy('prompt');
    setError(null);
    try {
      setPrompt((await api.aiPrompt(track, slug)).prompt);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const send = async () => {
    setBusy('review');
    setError(null);
    try {
      const image = await captureImage();
      setReview((await api.aiReview(track, slug, image)).review);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const copy = async () => {
    let text = prompt;
    if (!text) {
      text = (await api.aiPrompt(track, slug)).prompt;
      setPrompt(text);
    }
    void navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadPng = async () => {
    setBusy('image');
    setError(null);
    try {
      const image = await captureImage();
      if (!image) {
        setError('Nothing to export — draw something first.');
        return;
      }
      const a = document.createElement('a');
      a.href = `data:image/png;base64,${image}`;
      a.download = `${slug}.png`;
      a.click();
    } finally {
      setBusy(null);
    }
  };

  if (!hasAttempt) {
    return (
      <div className="callout small">
        Score your design first — a review of an unscored diagram can't compare the rubric against your own judgment.
      </div>
    );
  }

  return (
    <div className="stack" style={{ gap: '0.75rem' }}>
      <div className="callout small">
        The prompt bundles the requirements, your notes, the diagram (as a structured description, plus an image when you use
        the buttons below), and the rubric score — a review of the drawing alone can't tell whether it matches what you said.
      </div>

      <div className="row">
        <button className="btn btn-primary btn-sm" onClick={copy}>
          {copied ? 'Copied ✓' : 'Copy review prompt'}
        </button>
        <button className="btn btn-sm" onClick={downloadPng} disabled={busy !== null}>
          {busy === 'image' ? 'Exporting…' : 'Download PNG'}
        </button>
        <a className="btn btn-sm" href="https://chatgpt.com/" target="_blank" rel="noreferrer">
          ChatGPT ↗
        </a>
        <a className="btn btn-sm" href="https://claude.ai/new" target="_blank" rel="noreferrer">
          Claude ↗
        </a>
        <button className="btn btn-sm btn-ghost" onClick={load} disabled={busy !== null}>
          {busy === 'prompt' ? 'Building…' : prompt ? 'Refresh' : 'Show the prompt'}
        </button>
      </div>
      <div className="tiny muted">A copied prompt can't carry an image — download the PNG too and paste both into the chat.</div>

      <div className="row">
        {cfg.data?.configured ? (
          <>
            <button className="btn btn-sm" onClick={send} disabled={busy !== null}>
              {busy === 'review' ? (
                <>
                  <span className="spinner" /> Asking {cfg.data.model}…
                </>
              ) : (
                `Review with ${cfg.data.model}`
              )}
            </button>
            <span className="tiny muted">Sends your diagram to {cfg.data.baseUrl}.</span>
          </>
        ) : (
          <span className="tiny muted">
            No key needed for the buttons above. To have the app ask a model directly, configure one with{' '}
            <code>PUT /api/ai/config</code> (provider, baseUrl, model, apiKey) — stored in <code>data/ai.json</code>, never sent
            to the browser.
          </span>
        )}
      </div>

      {error && <ErrorBox message={error} />}
      {cfg.error && <div className="tiny muted">Couldn't read the AI settings: {cfg.error}</div>}

      {review && (
        <section>
          <h3 style={{ margin: '0 0 0.4rem' }}>Review</h3>
          <div className="ai-review small">{review}</div>
        </section>
      )}

      {prompt && (
        <details open={!review}>
          <summary className="small muted" style={{ cursor: 'pointer' }}>
            The prompt ({prompt.length.toLocaleString()} characters)
          </summary>
          <pre className="ref-code" style={{ marginTop: '0.5rem', maxHeight: '28rem', overflow: 'auto' }}>
            {prompt}
          </pre>
        </details>
      )}

      {busy === 'prompt' && !prompt && <Loading label="Building the prompt…" />}
    </div>
  );
}
