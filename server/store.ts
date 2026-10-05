import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import type { Progress } from '../shared/types.ts';

/** Everything the app persists lives here (gitignored). Ported from the DSA trainer's store.ts. */
export const DATA_DIR = resolve(process.env.ARCHITECT_DATA_DIR ?? join(process.cwd(), 'data'));
const PROGRESS_FILE = join(DATA_DIR, 'progress.json');

export function emptyProgress(): Progress {
  return { version: 1, ratings: {}, ratedAttempts: {}, history: [], hld: {}, lld: {} };
}

let progress: Progress | null = null;
let lock: Promise<unknown> = Promise.resolve();

async function load(): Promise<Progress> {
  if (progress) return progress;
  try {
    progress = { ...emptyProgress(), ...(JSON.parse(await readFile(PROGRESS_FILE, 'utf8')) as Progress) };
  } catch (err) {
    if (isErrno(err, 'ENOENT')) {
      progress = emptyProgress();
    } else if (err instanceof SyntaxError) {
      // Keep the unreadable file for inspection instead of silently overwriting it.
      const backup = `${PROGRESS_FILE}.corrupt-${Date.now()}`;
      await rename(PROGRESS_FILE, backup);
      console.warn(`progress.json was not valid JSON; moved it to ${backup} and started fresh.`);
      progress = emptyProgress();
    } else {
      throw err;
    }
  }
  return progress;
}

/** Read-only snapshot for GET handlers. */
export function readProgress(): Promise<Progress> {
  return serialize(load);
}

/** Runs `fn` against the progress document and persists it; calls are serialized. */
export function updateProgress<T>(fn: (p: Progress) => T): Promise<T> {
  return serialize(async () => {
    const p = await load();
    const result = fn(p);
    await atomicWrite(PROGRESS_FILE, JSON.stringify(p, null, 1));
    return result;
  });
}

export function resetProgress(): Promise<void> {
  return updateProgress((p) => {
    for (const key of Object.keys(p)) delete (p as unknown as Record<string, unknown>)[key];
    Object.assign(p, emptyProgress());
  });
}

function serialize<T>(fn: () => Promise<T>): Promise<T> {
  const run = lock.then(fn, fn);
  lock = run.catch(() => undefined);
  return run;
}

async function atomicWrite(file: string, data: string): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  await writeFile(tmp, data);
  // Windows can briefly lock the target (antivirus, indexers); retry the rename a few times.
  for (let attempt = 0; ; attempt++) {
    try {
      await rename(tmp, file);
      return;
    } catch (err) {
      const transient = isErrno(err, 'EPERM') || isErrno(err, 'EBUSY') || isErrno(err, 'EACCES');
      if (!transient || attempt >= 5) throw err;
      await new Promise((r) => setTimeout(r, 50 * (attempt + 1)));
    }
  }
}

function isErrno(err: unknown, code: string): boolean {
  return typeof err === 'object' && err !== null && (err as NodeJS.ErrnoException).code === code;
}
