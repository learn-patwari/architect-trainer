import { useEffect, useRef, useState } from 'react';
import type { Phase } from '../../../shared/timer/phases.ts';
import type { Track } from '../../../shared/types.ts';
import { api } from '../api.ts';

interface Props {
  track: Track;
  slug: string;
  phase: Phase;
  label: string;
  placeholder?: string;
  initial: string;
  onChange: (phase: Phase, text: string) => void;
}

/** One phase's own written field — the same debounced-autosave pattern as NotesPanel, keyed by phase. */
export function PhaseAnswerField({ track, slug, phase, label, placeholder, initial, onChange }: Props) {
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(true);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Text typed but not yet sent, remembered with ITS phase — switching phases mid-debounce must not misfile it.
  const pending = useRef<{ phase: Phase; text: string } | null>(null);

  useEffect(() => setValue(initial), [initial, phase]);

  useEffect(() => {
    const flush = () => {
      if (!pending.current) return;
      if (timeout.current) clearTimeout(timeout.current);
      const { phase: p, text } = pending.current;
      pending.current = null;
      api.savePhaseAnswer(track, slug, p, text, true).catch(() => {});
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

  const onEdit = (v: string) => {
    setValue(v);
    setSaved(false);
    onChange(phase, v);
    pending.current = { phase, text: v };
    if (timeout.current) clearTimeout(timeout.current);
    timeout.current = setTimeout(() => {
      pending.current = null;
      api
        .savePhaseAnswer(track, slug, phase, v)
        .then(() => setSaved(true))
        .catch(() => {});
    }, 800);
  };

  return (
    <div className="stack">
      <div className="spread">
        <h3 style={{ margin: 0 }}>{label}</h3>
        <span className="tiny muted">{saved ? 'Saved' : 'Saving…'}</span>
      </div>
      <textarea className="input" placeholder={placeholder} value={value} onChange={(e) => onEdit(e.target.value)} />
    </div>
  );
}
