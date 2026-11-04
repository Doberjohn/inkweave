import {useState} from 'react';

/** An opening of a dialog the page holds: what it was asked, whether it is open, and its key. */
export type Opening<Ask> = Ask & {
  open: boolean;
  /** Each opening mounts the dialog afresh, so it starts from what it was asked, never the last draft. */
  key: number;
};

/**
 * A dialog's opening, kept while it closes so its words stay through the exit, then dropped
 * once the dialog says its exit has run (`forget`).
 */
export function useOpening<Ask extends object>() {
  const [opening, setOpening] = useState<Opening<Ask> | null>(null);
  return {
    opening,
    drop: () => setOpening(null),
    open: (ask: Ask) => setOpening((now) => ({...ask, open: true, key: (now?.key ?? 0) + 1})),
    close: () => setOpening((now) => now && {...now, open: false}),
    // Only the closed opening it names: a dialog opened again since keeps its own.
    forget: (key: number) => setOpening((now) => (now !== null && !now.open && now.key === key ? null : now)),
  };
}
