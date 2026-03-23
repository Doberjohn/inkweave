import type {Playstyle, PlaystyleId} from '../types';

const playstyles: Playstyle[] = [
  {
    id: 'lore-denial',
    name: 'Lore Steal',
    description:
      'Cards that make your opponent lose lore. Stacking these creates a consistent denial strategy that pressures your opponent while you gain lore.',
    strategyTips: [
      'Density is everything — aim for 6-8 lore-loss cards so you reliably draw them each game.',
      'Pair with your own lore generation. Denying 1 lore per turn only works if you are also questing.',
      'Prioritize repeatable effects (quest triggers, location abilities) over one-shot actions.',
      'Early game matters most — removing lore on turns 2-4 can set your opponent behind for the rest of the game.',
    ],
  },
  {
    id: 'location-control',
    name: 'Locations',
    description:
      'Cards that synergize through location-based gameplay. Moving characters to locations, buffing them there, and triggering location payoffs.',
    strategyTips: [
      'Balance your roles — tutors and ramp get locations into play, but you need payoff and buff cards to win with them.',
      'Protect your locations with buff cards (willpower boosts, resist) since opponents will try to banish them.',
      'Include at least one tutor to find key locations consistently.',
      'Move effects are strongest when paired with at-location payoffs — free moves let you trigger payoffs without paying ink.',
      'Avoid overloading on locations themselves; 3-4 locations plus strong support cards is more effective than 6+ locations.',
    ],
  },
  {
    id: 'discard',
    name: 'Discard',
    description:
      'Force opponents to discard cards while leveraging hand-size advantage. Stack discard enablers to empty their hand, then capitalize with cards that reward having more cards than your opponent.',
    strategyTips: [
      'Run a mix of enablers and payoffs — enablers empty their hand, payoffs convert that into lore and stats.',
      'Repeatable enablers (quest triggers) outperform one-shot effects since they pressure every turn.',
      'Maintain your own hand size with card draw so you stay ahead on cards while forcing discards.',
      'Hand-cap effects shine in the late game when opponents naturally have fewer cards to work with.',
      'Timing matters — discard effects are most punishing when your opponent is down to their last 1-2 cards, which are usually the ones they fought hardest to keep.',
    ],
  },
];

const playstyleMap = new Map(playstyles.map((p) => [p.id, p]));

export const getAllPlaystyles = (): Playstyle[] => [...playstyles];

export const getPlaystyleById = (id: PlaystyleId): Playstyle | undefined => playstyleMap.get(id);
