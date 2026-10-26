import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import type {Ink} from '../cards';
import {SPACING} from '../../shared/constants';
import {createCard} from '../../shared/test-utils/factories';
import {PlaystyleGuide} from './PlaystyleGuide';
import type {PlaystyleGuide as Guide} from './playstyleGuides';

/** A key card as the page's card list holds it: the guide shows only its name and inks. */
const keyCard = (id: string, fullName: string, ink: Ink, ink2?: Ink) =>
  createCard({id, name: fullName.split(' - ')[0], fullName, ink, ink2, setCode: '10'});

// The guides as public/data/playstyleGuides.json words them.
const EXERT: Guide = {
  paragraphs: [
    "Only exerted characters can be challenged, so a character your opponent keeps ready is safe from your challengers. Exert decks take that away: their effects exert opposing characters on your turn, opening them to challenges, and their payoffs make it count for more. Some stop an exerted character from readying, so it can't quest or challenge on its owner's next turn, while others banish a strong exerted character or gain lore or a card from it.",
    "Most exert cards are Amethyst, with a few in Ruby and Amber, so the deck starts from Amethyst and picks a second ink with strong challengers to finish what it exerts. Lead with cheap exert effects, keep a card that stops a character from readying for the opponent's best quester, and balance exert effects against payoffs: a payoff needs an exerted target, while a spare exert effect still opens a challenge.",
  ],
  keyCards: ['1989', '3037', '1999', '2530', '2256', '1941'],
};

const EXERT_CARDS = [
  keyCard('1989', 'Elsa - Snow Queen', 'Amethyst'),
  keyCard('3037', 'Petrify', 'Amethyst'),
  keyCard('1999', "I'm Stuck!", 'Amethyst'),
  keyCard('2530', 'Pot of Honey', 'Amethyst'),
  keyCard('2256', 'Grimorum Arcanorum', 'Amethyst'),
  keyCard('1941', 'Minnie Mouse - Sweetheart Princess', 'Amber'),
];

const DETECTIVES: Guide = {
  paragraphs: [
    'Detectives is a tribal deck of characters with the Detective classification, led by Judy Hopps and Nick Wilde. Its payoffs reward playing several of them: they help your Detectives challenge by giving them Alert, Challenger and Resist, draw you a card when a Detective banishes a character in a challenge, and switch on extra effects when you already have another Detective in play.',
    'The payoffs are split almost evenly between Amber, Sapphire and Steel, so the deck pairs two of those three inks. Play cheap Detectives early, so the checks for another Detective are already on when the payoffs land, and play the buffs that last one turn just before a Detective challenges. Cards that find Detectives in your deck or return them from your discard keep the count up when challenges thin it.',
  ],
  keyCards: ['2339', '2345', '2368', '2376', '2361', '3281'],
};

const DETECTIVE_CARDS = [
  keyCard('2339', 'Judy Hopps - Lead Detective', 'Sapphire'),
  keyCard('2345', 'Judy Hopps - Uncovering Clues', 'Sapphire'),
  keyCard('2368', 'Basil - Tenacious Mouse', 'Steel'),
  keyCard('2376', 'Nick Wilde - Persistent Investigator', 'Steel'),
  keyCard('2361', 'Donald Duck - Ghost Hunter', 'Steel'),
  keyCard('3281', 'Elisa Maza - Hardworking Detective', 'Amber'),
];

const HUNNY: Guide = {
  paragraphs: [
    'Hunny is the Winnie the Pooh tribe: Pooh, Piglet, Tigger, Eeyore and the rest of the Hundred Acre Wood, each with the Hunny classification. Several of them get better while other Hunny characters are in play, gaining Resist, Evasive or lore, and others hand extra lore, Ward or Evasive to a chosen Hunny character, so the deck wants a few of them on the board at once.',
    "The tribe spans every ink, and one Christopher Robin lets a deck that runs him include Hunny characters of any ink. The Pooh and Piglet team-up rewards that with +1 lore for each different ink among your characters in play. Build around Amethyst and Sapphire, Christopher Robin's two inks, and play the cheap members early, so the checks for another Hunny character are already on when the rest arrive.",
  ],
  keyCards: ['3032', '3033', '3135', '3011', '3156', '3145'],
};

const HUNNY_CARDS = [
  keyCard('3032', 'Christopher Robin - Hunny Sage', 'Amethyst', 'Sapphire'),
  keyCard('3033', 'Winnie the Pooh & Piglet - Hunny Mages', 'Amethyst', 'Sapphire'),
  keyCard('3135', 'Eeyore - Hunny Scholar', 'Sapphire'),
  keyCard('3011', 'Winnie the Pooh - Hunny Archmage', 'Amethyst'),
  keyCard('3156', 'Owl - Hunny Ranger', 'Steel'),
  keyCard('3145', 'Big Book of Hunny', 'Sapphire'),
];

// The playstyle page's grid padding, on desktop and on phones.
const DESKTOP_PADDING = `0 ${SPACING.xxxl}px 48px`;
const PHONE_PADDING = `0 ${SPACING.lg}px 48px`;

const meta = {
  title: 'Features/Playstyles/PlaystyleGuide',
  component: PlaystyleGuide,
  parameters: {layout: 'fullscreen'},
  args: {
    name: 'Exert',
    guide: EXERT,
    cards: EXERT_CARDS,
    onOpenCard: fn(),
    padding: DESKTOP_PADDING,
  },
} satisfies Meta<typeof PlaystyleGuide>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Exert: Story = {};

export const Detectives: Story = {
  args: {name: 'Detectives', guide: DETECTIVES, cards: DETECTIVE_CARDS},
};

/** Key cards of two inks show both ink symbols. */
export const TwoInkKeyCards: Story = {
  args: {name: 'Hunny', guide: HUNNY, cards: HUNNY_CARDS},
};

/** Pot of Honey is no longer among the playstyle's cards, so the guide leaves it out. */
export const KeyCardLeftOut: Story = {
  args: {cards: EXERT_CARDS.filter((card) => card.id !== '2530')},
};

export const Phone: Story = {
  args: {padding: PHONE_PADDING},
  globals: {viewport: {value: 'mobile1'}},
};
