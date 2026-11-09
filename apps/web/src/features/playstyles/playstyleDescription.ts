import type {Playstyle} from 'inkweave-synergy-engine';
import {fitDescription} from '../../shared/lib/seoDescription';

/** A playstyle page's meta description: its tagline, then what the page lists. */
export function playstyleDescription({name, tagline}: Pick<Playstyle, 'name' | 'tagline'>): string {
  return fitDescription(
    `${tagline} Explore the cards, enablers, and payoffs that define the ${name} archetype in Disney Lorcana Core format.`,
    `${tagline} The ${name} archetype's cards and payoffs in Disney Lorcana Core.`,
    `The ${name} archetype's cards, enablers and payoffs in Disney Lorcana Core format.`,
  );
}
