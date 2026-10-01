import type {LorcanaJSONData} from './loader';

const PREVIEW_CARDS_PATH = '/data/previewCards.json';
let request: Promise<LorcanaJSONData | null> | null = null;

/** Drops the cached request, so the next caller fetches again, and resolves this one to null. */
function forgetRequest(): null {
  request = null;
  return null;
}

/**
 * The reveal season's preview cards, fetched once per page (#641): the card loader and the reveal
 * dates both read this file, and each used to fetch it. Resolves null when the file is absent or
 * the request fails. Only absence (a 404) is kept for the page; any other failure is forgotten, so
 * the next caller, a card-list retry included, tries again.
 */
export function fetchPreviewCards(): Promise<LorcanaJSONData | null> {
  request ??= fetch(PREVIEW_CARDS_PATH)
    .then((response) => {
      if (response.ok) return response.json() as Promise<LorcanaJSONData>;
      return response.status === 404 ? null : forgetRequest();
    })
    .catch(forgetRequest);
  return request;
}

/** @internal reset for testing */
export function _resetPreviewCardsCache(): void {
  request = null;
}
