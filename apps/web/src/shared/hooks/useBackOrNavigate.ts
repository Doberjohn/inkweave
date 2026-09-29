import {useLocation, useNavigate} from 'react-router-dom';

/**
 * A close/back action for a page that can also be where the user entered the site: it steps
 * back one entry when the user got here from inside Inkweave, and goes to `fallback`
 * otherwise, since stepping back from an entry page would leave the site.
 *
 * React Router keys the first location of a browsing session 'default' until the app itself
 * navigates, so 'default' means this page was opened directly: a search result, a shared
 * link, a new tab. (`history.length` cannot tell: it also counts the tab's other sites.)
 */
export function useBackOrNavigate(fallback: string): () => void {
  const navigate = useNavigate();
  const {key} = useLocation();
  return () => {
    if (key === 'default') navigate(fallback);
    else navigate(-1);
  };
}
