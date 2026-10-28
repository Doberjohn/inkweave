import {ICON_SIZE} from '../../shared/constants';

// The Friends section's glyphs (#852): 16px with 1.5px strokes, like SearchIcon, drawn in
// currentColor so the copy button's own color reaches them (muted, lighter on hover, green
// once the code is copied).

export function CopyIcon() {
  return (
    <svg aria-hidden="true" width={ICON_SIZE.sm} height={ICON_SIZE.sm} viewBox="0 0 16 16" fill="none">
      <rect x="5.75" y="5.75" width="7.5" height="7.5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M10.25 5.75v-1.5a1.5 1.5 0 0 0-1.5-1.5h-4.5a1.5 1.5 0 0 0-1.5 1.5v4.5a1.5 1.5 0 0 0 1.5 1.5h1.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function CheckIcon() {
  return (
    <svg aria-hidden="true" width={ICON_SIZE.sm} height={ICON_SIZE.sm} viewBox="0 0 16 16" fill="none">
      <path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** An open eye, for View binder, in the same 16px and 1.5px strokes. */
export function EyeIcon() {
  return (
    <svg aria-hidden="true" width={ICON_SIZE.sm} height={ICON_SIZE.sm} viewBox="0 0 16 16" fill="none">
      <path
        d="M1.75 8s2.25-4.25 6.25-4.25S14.25 8 14.25 8 12 12.25 8 12.25 1.75 8 1.75 8z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

/** Two people, for the friends who have a card, in the same 16px and 1.5px strokes. */
export function PeopleIcon() {
  return (
    <svg aria-hidden="true" width={ICON_SIZE.sm} height={ICON_SIZE.sm} viewBox="0 0 16 16" fill="none">
      <circle cx="6" cy="5.25" r="2.25" stroke="currentColor" strokeWidth="1.5" />
      <path d="M1.75 13.25c0-2.35 1.9-4 4.25-4s4.25 1.65 4.25 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M10.75 3.15a2.25 2.25 0 0 1 0 4.2M12 9.4c1.4.5 2.25 1.85 2.25 3.85" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/** A right chevron, for a row or a button that opens what it names. */
export function ChevronIcon() {
  return (
    <svg aria-hidden="true" width={ICON_SIZE.sm} height={ICON_SIZE.sm} viewBox="0 0 16 16" fill="none">
      <path d="M6 3.5L10.5 8 6 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Two people, filled, for a binder pocket's friends badge: zoomed down with a small pocket, the
 * outlined glyph's 1.5px strokes thin to a blur under a pixel.
 */
export function PeopleSolidIcon() {
  return (
    <svg aria-hidden="true" width={ICON_SIZE.sm} height={ICON_SIZE.sm} viewBox="0 0 16 16" fill="none">
      <circle cx="6" cy="5.3" r="2.5" fill="currentColor" />
      <path d="M1.6 13.4c.4-2.5 2.2-4 4.4-4s4 1.5 4.4 4z" fill="currentColor" />
      <circle cx="11.4" cy="5.9" r="2" fill="currentColor" opacity="0.75" />
      <path d="M11.1 9.5c1.9.1 3.1 1.5 3.4 3.9h-3.2c-.1-1.6-.6-2.9-1.4-3.7z" fill="currentColor" opacity="0.75" />
    </svg>
  );
}
