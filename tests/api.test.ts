import { mkdtempSync, rmSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { request, type Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const dataDir = mkdtempSync(join(tmpdir(), 'architect-api-'));
process.env.ARCHITECT_DATA_DIR = dataDir;

const { createApp } = await import('../server/app.ts');

let server: Server;
let base: string;

beforeAll(async () => {
  const app = createApp({ webDir: join(dataDir, 'no-such-dist') });
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolvePromise) => server.once('listening', resolvePromise));
  const { port } = server.address() as AddressInfo;
  base = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await new Promise((resolvePromise) => server.close(resolvePromise));
  rmSync(dataDir, { recursive: true, force: true });
});

interface Resp {
  status: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  json: any;
}

function call(path: string, init?: { method?: string; body?: unknown; headers?: Record<string, string> }): Promise<Resp> {
  return new Promise((resolvePromise, reject) => {
    const method = init?.method ?? 'GET';
    const isWrite = method !== 'GET' && method !== 'HEAD';
    // Every write needs a JSON content-type, even a bodyless DELETE — mirrors the real client.
    const body = isWrite ? JSON.stringify(init?.body ?? {}) : undefined;
    // Node's http.request doesn't auto-set content-length for a DELETE body (unlike a
    // browser's fetch, which the real client uses) — set it explicitly or the server's
    // JSON-required guard sees no body and rejects it.
    const headers = { ...(isWrite ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body!) } : {}), ...(init?.headers ?? {}) };
    const req = request(`${base}${path}`, { method, headers }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          resolvePromise({ status: res.statusCode!, json: data ? JSON.parse(data) : null });
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

const HLD_SLUG = 'design-a-url-shortener';
const LLD_SLUG = 'design-a-parking-lot';

function rect(id: string, x: number, y = 0) {
  return { id, type: 'rectangle', x, y, width: 120, height: 60, boundElements: [{ id: `${id}-t`, type: 'text' }] };
}
function text(id: string, containerId: string, value: string) {
  return { id, type: 'text', x: 0, y: 0, width: 100, height: 20, containerId, text: value };
}
function arrow(id: string, from: string, to: string, label?: string) {
  const els = [
    { id, type: 'arrow', x: 0, y: 0, width: 0, height: 0, startBinding: { elementId: from }, endBinding: { elementId: to }, boundElements: label ? [{ id: `${id}-t`, type: 'text' }] : null },
  ];
  if (label) els.push(text(`${id}-t`, id, label) as never);
  return els;
}

/** A scene that wires LB -> App -> Cache -> DB, all labeled and with an ID strategy named. */
function goodHldScene() {
  return [
    rect('lb', 0), text('lb-t', 'lb', 'Load Balancer'),
    rect('app', 200), text('app-t', 'app', 'API Server'),
    rect('cache', 400), text('cache-t', 'cache', 'Redis Cache'),
    rect('db', 600), text('db-t', 'db', 'DynamoDB'),
    { id: 'note', type: 'text', x: 0, y: 200, width: 300, height: 20, text: 'IDs: base62 counter' },
    ...arrow('a1', 'lb', 'app'), ...arrow('a2', 'app', 'cache'), ...arrow('a3', 'cache', 'db'),
  ];
}

/** A class diagram that should pass every check in the parking-lot LLD rubric. */
function goodLldScene() {
  return [
    rect('iface', 0), text('iface-t', 'iface', 'Vehicle Interface'),
    rect('car', 200), text('car-t', 'car', 'Car'),
    rect('moto', 400), text('moto-t', 'moto', 'Motorcycle'),
    rect('spotType', 0, 150), text('spotType-t', 'spotType', 'SpotType Enum'),
    rect('lot', 200, 150), text('lot-t', 'lot', 'ParkingLot'),
    rect('pricing', 400, 150), text('pricing-t', 'pricing', 'PricingStrategy'),
    ...arrow('r1', 'car', 'iface', 'implements'),
    ...arrow('r2', 'moto', 'iface', 'implements'),
    ...arrow('r3', 'lot', 'car', 'has-a'),
  ];
}

describe('HTTP API', () => {
  it('GET /api/state starts with no ratings and lists the curated problems for both tracks', async () => {
    const { status, json } = await call('/api/state');
    expect(status).toBe(200);
    expect(json.tracks.find((t: { track: string }) => t.track === 'hld').rating).toBeNull();
    expect(json.tracks.find((t: { track: string }) => t.track === 'lld').rating).toBeNull();
    expect(json.hldProblems.length).toBeGreaterThanOrEqual(3);
    expect(json.lldProblems.length).toBeGreaterThanOrEqual(2);
  });

  it('GET /api/problems/:track/:slug returns the problem view for both tracks', async () => {
    const hld = await call(`/api/problems/hld/${HLD_SLUG}`);
    expect(hld.status).toBe(200);
    expect(hld.json.title).toBe('Design a URL Shortener');
    expect(hld.json.phases.length).toBeGreaterThan(0);

    const lld = await call(`/api/problems/lld/${LLD_SLUG}`);
    expect(lld.status).toBe(200);
    expect(lld.json.title).toBe('Design a Parking Lot');
  });

  it('rejects an unknown track before touching any problem lookup', async () => {
    const { status, json } = await call(`/api/problems/not-a-track/${HLD_SLUG}`);
    expect(status).toBe(404);
    expect(json.error).toMatch(/unknown track/i);
  });

  it('404s for an unknown problem within a valid track', async () => {
    const { status } = await call('/api/problems/hld/not-a-real-problem');
    expect(status).toBe(404);
  });

  it('saves notes and a scene, then reflects them back in the problem view', async () => {
    await call(`/api/problems/hld/${HLD_SLUG}/notes`, { method: 'PUT', body: { notes: 'Reads dominate.' } });
    await call(`/api/problems/hld/${HLD_SLUG}/scene`, { method: 'PUT', body: { scene: goodHldScene() } });
    const { json } = await call(`/api/problems/hld/${HLD_SLUG}`);
    expect(json.progress.notes).toBe('Reads dominate.');
    expect(json.progress.scene).toHaveLength(goodHldScene().length);
  });

  it('saves a phase answer and reflects it back in the problem view', async () => {
    await call(`/api/problems/hld/${HLD_SLUG}/phase-answer`, { method: 'PUT', body: { phase: 'requirements', text: '100:1 read/write.' } });
    const { json } = await call(`/api/problems/hld/${HLD_SLUG}`);
    expect(json.progress.phaseAnswers.requirements).toBe('100:1 read/write.');
  });

  it('rejects a phase answer for an unknown phase', async () => {
    const { status, json } = await call(`/api/problems/hld/${HLD_SLUG}/phase-answer`, { method: 'PUT', body: { phase: 'not-a-phase', text: 'x' } });
    expect(status).toBe(400);
    expect(json.error).toMatch(/unknown phase/i);
  });

  it('saves the wizard position and returns it in the problem view (survives a reload/restart)', async () => {
    const res = await call(`/api/problems/hld/${HLD_SLUG}/phase-state`, { method: 'PUT', body: { phase: 'data-model', reviewed: ['requirements', 'estimation', 'api'] } });
    expect(res.status).toBe(200);
    const { json } = await call(`/api/problems/hld/${HLD_SLUG}`);
    expect(json.progress.currentPhase).toBe('data-model');
    expect(json.progress.reviewedPhases).toEqual(['requirements', 'estimation', 'api']);
    const bad = await call(`/api/problems/hld/${HLD_SLUG}/phase-state`, { method: 'PUT', body: { phase: 'nope', reviewed: [] } });
    expect(bad.status).toBe(400);
  });

  it('reveals hints one at a time, capped at 3, and reflects them back in the problem view', async () => {
    const first = await call(`/api/problems/hld/${HLD_SLUG}/hint`, { method: 'POST' });
    expect(first.json.revealedHints).toHaveLength(1);
    const second = await call(`/api/problems/hld/${HLD_SLUG}/hint`, { method: 'POST' });
    expect(second.json.revealedHints).toHaveLength(2);
    await call(`/api/problems/hld/${HLD_SLUG}/hint`, { method: 'POST' });
    const capped = await call(`/api/problems/hld/${HLD_SLUG}/hint`, { method: 'POST' });
    expect(capped.json.revealedHints).toHaveLength(3);

    const { json } = await call(`/api/problems/hld/${HLD_SLUG}`);
    expect(json.totalHints).toBe(3);
    expect(json.revealedHints).toHaveLength(3);
  });

  it('banks phase time', async () => {
    const { json } = await call(`/api/problems/hld/${HLD_SLUG}/time`, {
      method: 'POST',
      body: { phaseSeconds: { requirements: { elapsedSec: 120, activeSec: 110 } } },
    });
    expect(json.requirements).toEqual({ elapsedSec: 120, activeSec: 110 });
  });

  it('scores an HLD design, moves the HLD rating on the first attempt, and includes phase analysis', async () => {
    const { status, json } = await call(`/api/problems/hld/${HLD_SLUG}/score`, { method: 'POST', body: { scene: goodHldScene() } });
    expect(status).toBe(200);
    expect(json.rated).toBe(true);
    expect(json.ratingAfter).not.toBe(json.ratingBefore);
    expect(json.breakdown.length).toBeGreaterThan(0);
    expect(json.phaseAnalysis.length).toBeGreaterThan(0);

    const state = await call('/api/state');
    expect(state.json.tracks.find((t: { track: string }) => t.track === 'hld').rating).toBe(json.ratingAfter);
    // LLD's rating must be completely untouched by an HLD attempt.
    expect(state.json.tracks.find((t: { track: string }) => t.track === 'lld').rating).toBeNull();
  });

  it('scores an LLD class diagram on its own rubric and rating track', async () => {
    const { status, json } = await call(`/api/problems/lld/${LLD_SLUG}/score`, { method: 'POST', body: { scene: goodLldScene() } });
    expect(status).toBe(200);
    expect(json.rated).toBe(true);
    expect(json.percent).toBeGreaterThan(50);

    const state = await call('/api/state');
    expect(state.json.tracks.find((t: { track: string }) => t.track === 'lld').rating).toBe(json.ratingAfter);
  });

  it('does not rate a second attempt on the same problem', async () => {
    const { json } = await call(`/api/problems/hld/${HLD_SLUG}/score`, { method: 'POST', body: { scene: goodHldScene() } });
    expect(json.rated).toBe(false);
  });

  it('rejects scoring an empty scene', async () => {
    const { status, json } = await call(`/api/problems/hld/${HLD_SLUG}/score`, { method: 'POST', body: { scene: [] } });
    expect(status).toBe(400);
    expect(json.error).toMatch(/draw something/i);
  });

  it('builds an AI review prompt with no key configured', async () => {
    const { status, json } = await call(`/api/problems/hld/${HLD_SLUG}/ai-prompt`);
    expect(status).toBe(200);
    expect(json.prompt).toContain('Design a URL Shortener');
  });

  it('reports AI as not configured, then rejects a review request', async () => {
    const cfg = await call('/api/ai/config');
    expect(cfg.json.configured).toBe(false);
    const { status, json } = await call(`/api/problems/hld/${HLD_SLUG}/ai-review`, { method: 'POST', body: { imageBase64: null } });
    expect(status).toBe(400);
    expect(json.error).toMatch(/no model configured/i);
  });

  it('saves and clears an AI provider config without ever echoing the key back', async () => {
    const saved = await call('/api/ai/config', { method: 'PUT', body: { provider: 'anthropic', apiKey: 'sk-test-123', model: 'claude-sonnet-5' } });
    expect(saved.json.configured).toBe(true);
    expect(saved.json.hasKey).toBe(true);
    expect(JSON.stringify(saved.json)).not.toContain('sk-test-123');
    const cleared = await call('/api/ai/config', { method: 'DELETE' });
    expect(cleared.json.configured).toBe(false);
  });

  it('resets progress for both tracks', async () => {
    const bad = await call('/api/reset', { method: 'POST', body: {} });
    expect(bad.status).toBe(400);
    const { status } = await call('/api/reset', { method: 'POST', body: { confirm: 'RESET' } });
    expect(status).toBe(200);
    const { json } = await call('/api/state');
    expect(json.tracks.find((t: { track: string }) => t.track === 'hld').rating).toBeNull();
    expect(json.tracks.find((t: { track: string }) => t.track === 'lld').rating).toBeNull();
  });

  it('rejects a non-local Host header', async () => {
    const { status } = await call('/api/state', { headers: { host: 'evil.example.com' } });
    expect(status).toBe(403);
  });

  it('rejects a write with no JSON content-type', async () => {
    const { status } = await new Promise<{ status: number }>((resolvePromise, reject) => {
      const req = request(`${base}/api/reset`, { method: 'POST' }, (res) => {
        res.resume();
        resolvePromise({ status: res.statusCode! });
      });
      req.on('error', reject);
      req.write('{"confirm":"RESET"}');
      req.end();
    });
    expect(status).toBe(415);
  });
});
