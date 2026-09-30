import {useLocation, useNavigate} from 'react-router-dom';

/**
 * Whether the page shown is where the visit to Inkweave started. The browser router keeps its
 * position in the tab's history in `history.state.idx` (React Router internals, verified on
 * react-router 7.18.4): 0 on the entry page, one more for each push, and unchanged by a
 * replace. So a redirect from the entry page (`/compare/X/X` shows `/card/X` with a replace,
 * which gives the location a new key) is still the entry page. Without `idx` (a MemoryRouter),
 * fall back to the location key, which React Router leaves 'default' on the session's first
 * location until the app itself navigates. (`history.length` cannot tell: it also counts the
 * tab's other sites.)
 */
function onEntryPage(locationKey: string): boolean {
  const idx = (window.history.state as {idx?: unknown} | null)?.idx;
  return typeof idx === 'number' ? idx === 0 : locationKey === 'default';
}

/**
 * A close/back action for a page that can also be where the user entered the site: it steps
 * back one entry when the user got here from inside Inkweave, and goes to `fallback`
 * otherwise (a search result, a shared link, a new tab), since stepping back from the entry
 * page would leave the site.
 */
export function useBackOrNavigate(fallback: string): () => void {
  const navigate = useNavigate();
  const {key} = useLocation();
  return () => {
    if (onEntryPage(key)) navigate(fallback);
    else navigate(-1);
  };
}
