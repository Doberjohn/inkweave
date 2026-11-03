import type {Ink} from 'inkweave-synergy-engine';
import type {Breadcrumb} from '../components/Seo';

/**
 * The trail to an ink's hub, which its card pages extend: one name and depth for /ink/<ink>
 * wherever a page's structured data names it. The hub's slug is its ink in lower case
 * (`inkHubs.test.ts` holds every hub to that).
 */
export function inkHubTrail(ink: Ink): Breadcrumb[] {
  return [
    {name: 'Home', path: '/'},
    {name: 'Inks', path: '/inks'},
    {name: ink, path: `/ink/${ink.toLowerCase()}`},
  ];
}
