import type {Playstyle, PlaystyleId} from '../types';

const playstyles: Playstyle[] = [
  {
    id: 'lore-denial',
    name: 'Lore Denial',
    tagline: 'Cards that make your opponent lose lore.',
    description:
      'Cards that make your opponent lose lore. Songs, character abilities, and location triggers that strip points off their score. Each one you add slows the race in your favor without needing extra quests of your own.',
    strategyTips: [
      'Aim for 6 to 8 lore stealing cards so you reliably draw them each game.',
      'Prioritize repeatable effects (quest triggers, location abilities) over one-shot actions.',
      'Early game matters most — removing lore on turns 2-4 can set your opponent behind for the rest of the game.',
    ],
  },
  {
    id: 'location-control',
    name: 'Locations',
    tagline: 'Cards that build their value around locations.',
    description:
      'Cards that build their value around locations. Search for the right location, move characters into it for stat boosts, and stack location-quest triggers so each turn a location is in play earns extra lore.',
    strategyTips: [
      'Balance your roles — search and ramp get locations into play, but you need payoff and buff cards to win with them.',
      'Protect your locations with buff cards (willpower boosts, resist) since opponents will try to banish them.',
      'Include at least one search effect to find key locations consistently.',
      'Move effects are strongest when paired with at-location payoffs — free moves let you trigger payoffs without paying ink.',
      'Avoid overloading on locations themselves; 3-4 locations plus strong support cards is more effective than 6+ locations.',
    ],
  },
  {
    id: 'discard',
    name: 'Discard',
    tagline: 'Force opponents to discard cards while you keep yours.',
    description:
      'Force opponents to discard cards while you keep yours. Stack effects that empty their hand each turn, then follow up with cards that reward having more cards than they do. The fewer cards they hold, the more freely your characters can quest and challenge.',
    strategyTips: [
      'Run a mix of enablers and payoffs — enablers empty their hand, payoffs convert that into lore and stats.',
      'Repeatable enablers (quest triggers) outperform one-shot effects since they pressure every turn.',
      'Maintain your own hand size with card draw so you stay ahead on cards while forcing discards.',
      'Hand-cap effects shine in the late game when opponents naturally have fewer cards to work with.',
      'Timing matters — discard effects are most punishing when your opponent is down to their last 1-2 cards, which are usually the ones they fought hardest to keep.',
    ],
  },
  {
    id: 'toy',
    name: 'Toys',
    tagline: 'Toy characters and the cards that reward running them.',
    description:
      "Toy characters and the cards that reward running them. Andy's Toys search the deck for more Toys and grow stronger when others are around; Sid's Toys send themselves to the discard pile to trigger their effects again. Each Toy you add makes the rest of the strategy stronger.",
    strategyTips: [
      'Aim for 12 to 16 Toys plus 4 to 6 payoffs so search effects and density triggers reliably hit.',
      "Search effects (Woody — Leader of the Toys, You've Got a Friend in Me) chain into free plays — keep cheap Toys in the deck for them to fetch.",
      "The Sid's Toys package (Hand-in-the-Box, Wind-Up Frog, Bouncing Ducky, Jingle Joe, Sid Phillips) rewards self-banish loops — pair with self-banish cards or trade aggressively.",
      'Pizza Planet — Spaceport gives free moves for Toys; pair with at-location payoffs (Beast — Snowfield Troublemaker) for cross-archetype value.',
      "The tribe is mostly Amber and Ruby. Amber+Ruby decks get the deepest pool; mono-Amber leans on Andy's Toys, mono-Ruby leans on Sid's Toys.",
    ],
  },
  {
    id: 'ramp',
    name: 'Ramp',
    tagline: 'Speed up your ink so you can play powerful cards earlier than your opponent.',
    description:
      'Speed up your ink so you can play powerful cards earlier than your opponent. Some cards put extra cards into your inkwell each turn, others trigger effects every time you ink a card, and a few discount the cost of what you play. Stack all three for turns where you play far above your ink count.',
    strategyTips: [
      'Pair inkwell ramp with inkwell triggers for the strongest synergy — each extra ink fires every trigger on board.',
      'Deck-top ramp (Sapphire) is free mana with no card cost. Hand-to-inkwell ramp trades a card for speed — run card draw to compensate.',
      'Cost reduction cards (Amber) stack with inkwell ramp — Lantern discount + extra ink means you can deploy two threats in one turn.',
      'Repeating triggers (Coils, Jafar) scale with the number of inks per turn. Once-per-turn triggers (Raya, Lyle) are strong but cap at one activation.',
      'Ramp is strongest in turns 2-5 when the extra ink lets you play 5-6 cost cards while opponents are still at 3-4.',
    ],
  },
  {
    id: 'sacrifice',
    name: 'Sacrifice',
    tagline: 'Banish your own characters on demand to cash in banish payoffs.',
    description:
      'Banish your own characters on demand to cash in banish payoffs. Self-banish cards let you banish a character whenever you want, and banish-trigger characters reward you when they leave play. Pairing the two converts a "maybe the opponent trades into it" payoff into a guaranteed, on-your-terms value engine.',
    strategyTips: [
      'You need both halves: self-banish cards without payoffs do nothing, payoffs without a way to banish wait on the opponent. Run a handful of each.',
      'The combo lives in Ruby and Emerald, where every self-banish card currently sits. Splash a second ink for the deepest payoff pool.',
      'Banish triggers that draw or gain lore (Diablo, David Xanatos) turn each sacrifice into raw card or tempo advantage.',
      'Self-banish cards that do something extra (Time to Go! draws, The Claw bounces) pay you twice, once for their own effect and once for the payoff.',
      'Tribal banish triggers (Racers, Illusions, Puppies) fire off any banish, so a generic self-banish card still turns them on.',
    ],
  },
];

const playstyleMap = new Map(playstyles.map((p) => [p.id, p]));

export const getAllPlaystyles = (): Playstyle[] => [...playstyles];

export const getPlaystyleById = (id: PlaystyleId): Playstyle | undefined => playstyleMap.get(id);
