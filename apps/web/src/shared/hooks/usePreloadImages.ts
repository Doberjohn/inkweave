import {useEffect} from 'react';

/**
 * Injects <link rel="preload" as="image"> into <head> for the given URLs.
 * Cleans up on unmount. Skips duplicates and empty strings.
 *
 * Callers can pass a fresh array each render — the hook serializes URLs
 * internally so the effect only re-runs when actual contents change.
 */
export function usePreloadImages(urls: string[]) {
  // Serialize to a stable primitive so callers don't need useMemo.
  const key = urls.join('\0');
  useEffect(() => {
    const parsed = key ? key.split('\0') : [];
    const links: HTMLLinkElement[] = [];
    for (const url of parsed) {
      if (!url) continue;
      if (document.querySelector(`link[rel="preload"][href="${url}"]`)) continue;
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = url;
      document.head.appendChild(link);
      links.push(link);
    }
    return () => links.forEach((l) => l.remove());
  }, [key]);
}
