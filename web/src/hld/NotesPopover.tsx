import { useState } from 'react';
import type { Track } from '../../../shared/types.ts';
import { NotesPanel } from './NotesPanel.tsx';

/**
 * Notes as a one-click floating popup instead of a card you have to scroll to:
 * a fixed round button that toggles a small panel above it, so it's reachable
 * from any phase without leaving the canvas or the current field.
 *
 * The panel stays mounted while closed (just hidden). Unmounting it would throw
 * away its text state, and re-opening would show the notes as they were when the
 * page first loaded — silently discarding anything typed since.
 */
export function NotesPopover({ track, slug, initial }: { track: Track; slug: string; initial: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="notes-popover" hidden={!open}>
        <button className="btn btn-sm btn-ghost notes-popover-close" onClick={() => setOpen(false)} aria-label="Close notes">
          ✕
        </button>
        <NotesPanel track={track} slug={slug} initial={initial} />
      </div>
      <button className="notes-fab" onClick={() => setOpen((o) => !o)} aria-expanded={open} title="Your notes">
        📝
      </button>
    </>
  );
}
