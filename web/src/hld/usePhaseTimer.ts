import { useCallback, useEffect, useRef, useState } from 'react';
import { PHASES, type Phase } from '../../../shared/timer/phases.ts';
import type { PhaseTimes } from '../../../shared/types.ts';

/**
 * A generalized version of the DSA trainer's useTimer.ts: the same visibility-
 * tracking effect and AWAY_LIMIT_MS auto-pause, but time accumulates into
 * per-phase buckets instead of one global clock, and `setPhase` banks time into
 * the outgoing phase before switching to the next.
 */

export const AWAY_LIMIT_MS = 5 * 60 * 1000;

export type TimerStatus = 'idle' | 'running' | 'paused' | 'stopped';

interface PhaseBucket {
  elapsedMs: number;
  activeMs: number;
}
type PhaseBuckets = Record<Phase, PhaseBucket>;

function emptyBuckets(): PhaseBuckets {
  const out = {} as PhaseBuckets;
  for (const p of PHASES) out[p.id] = { elapsedMs: 0, activeMs: 0 };
  return out;
}

export interface UsePhaseTimer {
  status: TimerStatus;
  autoPaused: boolean;
  phase: Phase;
  away: boolean;
  elapsedSec: Record<Phase, number>;
  activeSec: Record<Phase, number>;
  totalElapsedSec: number;
  totalActiveSec: number;
  setPhase: (p: Phase) => void;
  start: () => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  restart: () => void;
  /** Seconds not yet handed to the server, per phase, and a way to mark them banked. */
  takeUnflushed: () => Partial<Record<Phase, { elapsedSec: number; activeSec: number }>>;
}

function isInFront(): boolean {
  if (typeof document === 'undefined') return true;
  return document.visibilityState === 'visible' && document.hasFocus();
}

/** What a previous session left behind: which phase you were on, and the time already banked per phase. */
export interface TimerRestore {
  phase?: Phase;
  phaseTimes?: PhaseTimes;
}

function bucketsFrom(times: PhaseTimes | undefined): PhaseBuckets {
  const out = emptyBuckets();
  for (const p of PHASES) {
    const t = times?.[p.id];
    if (t) out[p.id] = { elapsedMs: t.elapsedSec * 1000, activeMs: t.activeSec * 1000 };
  }
  return out;
}

export function usePhaseTimer(autoStart = true, restore?: TimerRestore): UsePhaseTimer {
  // Restoring a session that already has time banked: resume on the same phase with the same
  // totals, but PAUSED — the time you spent away (browser closed, server restarted) isn't work time.
  const restored = useRef(Object.values(restore?.phaseTimes ?? {}).some((t) => (t?.elapsedSec ?? 0) > 0)).current;
  const startRunning = autoStart && !restored;
  const [status, setStatus] = useState<TimerStatus>(startRunning ? 'running' : restored ? 'paused' : 'idle');
  const [phase, setPhaseState] = useState<Phase>(restore?.phase ?? PHASES[0]!.id);
  const [away, setAway] = useState(() => !isInFront());
  const [autoPaused, setAutoPaused] = useState(restored);
  const awayTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [, tick] = useState(0);

  const buckets = useRef<PhaseBuckets>(bucketsFrom(restore?.phaseTimes));
  const currentPhase = useRef<Phase>(phase);
  const elapsedFrom = useRef<number | null>(startRunning ? Date.now() : null);
  const activeFrom = useRef<number | null>(startRunning && isInFront() ? Date.now() : null);
  // Already on the server, so the periodic flush must only send what accrues from here on.
  const flushed = useRef<PhaseBuckets>(bucketsFrom(restore?.phaseTimes));

  /** Folds whatever is running into the current phase's bucket, so every clock can be read exactly. */
  const settle = useCallback((now = Date.now()) => {
    const bucket = buckets.current[currentPhase.current];
    if (elapsedFrom.current != null) {
      bucket.elapsedMs += now - elapsedFrom.current;
      elapsedFrom.current = now;
    }
    if (activeFrom.current != null) {
      bucket.activeMs += now - activeFrom.current;
      activeFrom.current = now;
    }
  }, []);

  const start = useCallback(() => {
    settle();
    elapsedFrom.current = Date.now();
    activeFrom.current = isInFront() ? Date.now() : null;
    setAway(!isInFront());
    setAutoPaused(false);
    setStatus('running');
  }, [settle]);

  const halt = useCallback(
    (next: TimerStatus) => {
      settle();
      elapsedFrom.current = null;
      activeFrom.current = null;
      setStatus(next);
    },
    [settle],
  );

  const pause = useCallback(() => {
    setAutoPaused(false);
    halt('paused');
  }, [halt]);
  const stop = useCallback(() => {
    setAutoPaused(false);
    halt('stopped');
  }, [halt]);

  const restart = useCallback(() => {
    buckets.current = emptyBuckets();
    flushed.current = emptyBuckets();
    currentPhase.current = PHASES[0]!.id;
    setPhaseState(PHASES[0]!.id);
    start();
  }, [start]);

  const setPhase = useCallback(
    (next: Phase) => {
      settle();
      currentPhase.current = next;
      setPhaseState(next);
    },
    [settle],
  );

  // Only the active clock follows the window; the wall clock keeps running — until
  // you've been gone long enough that you clearly aren't coming back.
  useEffect(() => {
    const clearAwayTimer = () => {
      if (awayTimeout.current != null) clearTimeout(awayTimeout.current);
      awayTimeout.current = null;
    };
    const sync = () => {
      const front = isInFront();
      setAway(!front);
      if (status !== 'running') return;
      settle();
      activeFrom.current = front ? Date.now() : null;
      clearAwayTimer();
      if (!front) {
        awayTimeout.current = setTimeout(() => {
          setAutoPaused(true);
          halt('paused');
        }, AWAY_LIMIT_MS);
      }
    };
    sync();
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('focus', sync);
    window.addEventListener('blur', sync);
    return () => {
      clearAwayTimer();
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('focus', sync);
      window.removeEventListener('blur', sync);
    };
  }, [status, settle, halt]);

  // Redraw once a second while something is moving.
  useEffect(() => {
    if (status !== 'running') return;
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [status]);

  const takeUnflushed = useCallback(() => {
    settle();
    const out: Partial<Record<Phase, { elapsedSec: number; activeSec: number }>> = {};
    for (const p of PHASES) {
      const bucket = buckets.current[p.id];
      const fl = flushed.current[p.id];
      const elapsedSec = Math.floor((bucket.elapsedMs - fl.elapsedMs) / 1000);
      const activeSec = Math.floor((bucket.activeMs - fl.activeMs) / 1000);
      if (elapsedSec <= 0) continue;
      fl.elapsedMs += elapsedSec * 1000;
      fl.activeMs += Math.max(0, activeSec) * 1000;
      out[p.id] = { elapsedSec, activeSec: Math.max(0, Math.min(elapsedSec, activeSec)) };
    }
    return out;
  }, [settle]);

  const now = Date.now();
  const elapsedSec = {} as Record<Phase, number>;
  const activeSec = {} as Record<Phase, number>;
  let totalElapsedSec = 0;
  let totalActiveSec = 0;
  for (const p of PHASES) {
    const bucket = buckets.current[p.id];
    const isHot = p.id === currentPhase.current;
    const liveElapsed = bucket.elapsedMs + (isHot && elapsedFrom.current != null ? now - elapsedFrom.current : 0);
    const liveActive = bucket.activeMs + (isHot && activeFrom.current != null ? now - activeFrom.current : 0);
    elapsedSec[p.id] = Math.floor(liveElapsed / 1000);
    activeSec[p.id] = Math.floor(liveActive / 1000);
    totalElapsedSec += elapsedSec[p.id];
    totalActiveSec += activeSec[p.id];
  }

  return {
    status,
    autoPaused,
    phase,
    away,
    elapsedSec,
    activeSec,
    totalElapsedSec,
    totalActiveSec,
    setPhase,
    start,
    pause,
    resume: start,
    stop,
    restart,
    takeUnflushed,
  };
}
