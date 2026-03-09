import {useEffect} from 'react';

/**
 * Injects <link rel="preload" as="image"> into <head> for the given URLs.
 * Cleans up on unmount. Skips duplicates and empty strings.
 */
export function usePreloadImages(urls: string[]) {
  useEffect(() => {
    const links: HTMLLinkElement[] = [];
    for (const url of urls) {
      if (!url) continue;
      // Skip if already preloaded
      if (document.querySelector(`link[rel="preload"][href="${url}"]`)) continue;
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = url;
      document.head.appendChild(link);
      links.push(link);
    }
    return () => links.forEach((l) => l.remove());
  }, [urls]);
}
