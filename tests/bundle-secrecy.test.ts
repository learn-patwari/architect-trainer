import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { URL_SHORTENER } from '../shared/hld/url-shortener.ts';

/**
 * The DSA trainer's discipline: the answer key lives in shared/ but is imported
 * only by server/ code, never by web/src — so it never reaches the browser
 * bundle. This asserts that directly, by grepping the emitted JS, rather than
 * only reasoning about which files import which.
 *
 * Deliberately does NOT run `vite build` itself (a cold build takes well over a
 * minute and destabilizes the test worker's own IPC heartbeat). Run `npm run
 * build` first — `npm start` does this too — then `npm test` picks up dist/web.
 * With no build yet, this suite reports itself skipped rather than failing.
 */

const DIST_ASSETS = join(process.cwd(), 'dist', 'web', 'assets');
const built = existsSync(DIST_ASSETS);
let bundle = '';

beforeAll(() => {
  if (!built) return;
  bundle = readdirSync(DIST_ASSETS)
    .filter((f) => f.endsWith('.js'))
    .map((f) => readFileSync(join(DIST_ASSETS, f), 'utf8'))
    .join('\n');
});

describe.skipIf(!built)('the reference architecture and rubric internals never reach the browser bundle', () => {
  it('does not contain the reference architecture text', () => {
    // Two long, distinctive slices of the answer-key prose, from the start and the middle —
    // not something that could appear by coincidence, unlike the problem's slug (which
    // legitimately appears in a client-side route and would be a false positive to check for).
    const text = URL_SHORTENER.referenceApproach;
    expect(bundle).not.toContain(text.slice(0, 60));
    expect(bundle).not.toContain(text.slice(text.length / 2, text.length / 2 + 60));
  });

  it("does not contain the rubric checks' labels", () => {
    for (const check of URL_SHORTENER.rubric.checks) {
      expect(bundle).not.toContain(check.label);
    }
  });

  it('does not contain the hints (revealed one at a time via the server, never bundled whole)', () => {
    for (const hint of URL_SHORTENER.hints) {
      expect(bundle).not.toContain(hint);
    }
  });
});

if (!built) {
  // eslint-disable-next-line no-console
  console.warn('\n[bundle-secrecy] Skipped: no dist/web build found. Run `npm run build` first to exercise this check.\n');
}
