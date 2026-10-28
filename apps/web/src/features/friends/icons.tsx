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

/** An open eye, for View binder (#1045), in the same 16px and 1.5px strokes. */
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
