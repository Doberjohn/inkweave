import type {LorcanaJSONData} from './loader';

const PREVIEW_CARDS_PATH = '/data/previewCards.json';
let request: Promise<LorcanaJSONData | null> | null = null;

/**
 * The reveal season's preview cards, fetched once per page (#641): the card loader and the reveal
 * dates both read this file, and each used to fetch it. Resolves null when the file is absent or
 * unreadable; a failed request isn't kept, so the next caller tries again.
 */
export function fetchPreviewCards(): Promise<LorcanaJSONData | null> {
  request ??= fetch(PREVIEW_CARDS_PATH)
    .then((response) => (response.ok ? (response.json() as Promise<LorcanaJSONData>) : null))
    .catch(() => {
      request = null;
      return null;
    });
  return request;
}

/** @internal reset for testing */
export function _resetPreviewCardsCache(): void {
  request = null;
}
