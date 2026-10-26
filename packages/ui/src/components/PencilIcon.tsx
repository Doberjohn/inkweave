import {ICON_SIZE} from '../tokens/theme';

/** A pencil: 16px with 1.5px strokes, like SearchIcon, drawn in currentColor so its button's color reaches it. */
export function PencilIcon() {
  return (
    <svg aria-hidden="true" width={ICON_SIZE.sm} height={ICON_SIZE.sm} viewBox="0 0 16 16" fill="none">
      <path
        d="M11.5 2.5a1.41 1.41 0 0 1 2 2l-8 8-3 1 1-3 8-8z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M10 4l2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
