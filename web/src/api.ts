import { useCallback, useEffect, useState } from 'react';
import type { Phase } from '../../shared/timer/phases.ts';
import type { DashboardState, ProblemView, ScoreResponse, Track } from '../../shared/types.ts';

export type Provider = 'openai' | 'anthropic' | 'ollama';

export interface AiConfigView {
  configured: boolean;
  provider: Provider;
  baseUrl: string;
  model: string;
  maxTokens: number;
  hasKey: boolean;
}

export interface AiReviewResult {
  review: string;
  model: string;
  provider: Provider;
  promptChars: number;
  at: string;
}

async function call<T>(path: string, init?: { method?: string; body?: unknown; keepalive?: boolean }): Promise<T> {
  const method = init?.method ?? 'GET';
  // The server requires a JSON content-type on every write (including a bodyless DELETE),
  // so a plain HTML form from another page can never satisfy it.
  const isWrite = method !== 'GET' && method !== 'HEAD';
  const res = await fetch(`/api${path}`, {
    method,
    headers: isWrite ? { 'Content-Type': 'application/json' } : undefined,
    body: isWrite ? JSON.stringify(init?.body ?? {}) : undefined,
    // Lets a save fired while the tab is closing still complete instead of being cancelled.
    keepalive: init?.keepalive,
  });
  const data = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok) throw new Error(data?.error ?? `Request failed (HTTP ${res.status}). Is the API server running?`);
  return data as T;
}

function base(track: Track, slug: string): string {
  return `/problems/${track}/${encodeURIComponent(slug)}`;
}

export const api = {
  state: () => call<DashboardState>('/state'),
  problem: (track: Track, slug: string) => call<ProblemView>(base(track, slug)),
  saveScene: (track: Track, slug: string, scene: unknown) => call<{ ok: true }>(`${base(track, slug)}/scene`, { method: 'PUT', body: { scene } }),
  saveNotes: (track: Track, slug: string, notes: string, keepalive = false) =>
    call<{ ok: true }>(`${base(track, slug)}/notes`, { method: 'PUT', body: { notes }, keepalive }),
  savePhaseAnswer: (track: Track, slug: string, phase: Phase, text: string, keepalive = false) =>
    call<{ ok: true }>(`${base(track, slug)}/phase-answer`, { method: 'PUT', body: { phase, text }, keepalive }),
  savePhaseState: (track: Track, slug: string, phase: Phase, reviewed: Phase[], resetTimes = false) =>
    call<{ ok: true }>(`${base(track, slug)}/phase-state`, { method: 'PUT', body: { phase, reviewed, resetTimes }, keepalive: true }),
  addTime: (track: Track, slug: string, phaseSeconds: Record<string, { elapsedSec: number; activeSec: number }>) =>
    call<Record<string, { elapsedSec: number; activeSec: number }>>(`${base(track, slug)}/time`, { method: 'POST', body: { phaseSeconds }, keepalive: true }),
  score: (track: Track, slug: string, scene: unknown) => call<ScoreResponse>(`${base(track, slug)}/score`, { method: 'POST', body: { scene } }),
  requestHint: (track: Track, slug: string) => call<{ revealedHints: string[] }>(`${base(track, slug)}/hint`, { method: 'POST' }),
  aiPrompt: (track: Track, slug: string) => call<{ prompt: string }>(`${base(track, slug)}/ai-prompt`),
  aiReview: (track: Track, slug: string, imageBase64: string | null) =>
    call<AiReviewResult>(`${base(track, slug)}/ai-review`, { method: 'POST', body: { imageBase64 } }),
  aiConfig: () => call<AiConfigView>('/ai/config'),
  saveAiConfig: (body: unknown) => call<AiConfigView>('/ai/config', { method: 'PUT', body }),
  clearAiConfig: () => call<AiConfigView>('/ai/config', { method: 'DELETE' }),
  reset: () => call<{ ok: true }>('/reset', { method: 'POST', body: { confirm: 'RESET' } }),
};

export interface Load<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => void;
}

/** Fetches once (and again whenever `deps` change or `reload` is called), tracking loading/error state. */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[]): Load<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fn()
      .then((d) => {
        if (alive) {
          setData(d);
          setLoading(false);
        }
      })
      .catch((e: Error) => {
        if (alive) {
          setError(e.message);
          setLoading(false);
        }
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, loading, reload };
}
