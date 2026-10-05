import { useEffect, useRef, useState } from 'react';
import type { Track } from '../../../shared/types.ts';
import { api } from '../api.ts';

export function NotesPanel({ track, slug, initial }: { track: Track; slug: string; initial: string }) {
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(true);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Text typed but not yet sent. Cleared once a save is attempted; flushed on hide/close/unmount.
  const pending = useRef<string | null>(null);

  useEffect(() => setValue(initial), [initial]);

  useEffect(() => {
    const flush = () => {
      if (pending.current == null) return;
      if (timeout.current) clearTimeout(timeout.current);
      const text = pending.current;
      pending.current = null;
      api.saveNotes(track, slug, text, true).catch(() => {});
    };
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onHide);
      flush();
    };
  }, [track, slug]);

  const onChange = (v: string) => {
    setValue(v);
    setSaved(false);
    pending.current = v;
    if (timeout.current) clearTimeout(timeout.current);
    timeout.current = setTimeout(() => {
      pending.current = null;
      api
        .saveNotes(track, slug, v)
        .then(() => setSaved(true))
        .catch(() => {});
    }, 800);
  };

  return (
    <div className="stack">
      <div className="spread">
        <h3 style={{ margin: 0 }}>Your notes</h3>
        <span className="tiny muted">{saved ? 'Saved' : 'Saving…'}</span>
      </div>
      <textarea
        className="input"
        placeholder="Requirements you're assuming, scale numbers, trade-offs you're weighing — anything you'd say out loud in the interview…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
