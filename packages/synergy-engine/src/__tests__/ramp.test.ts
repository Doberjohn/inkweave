import {describe, it, expect} from 'vitest';
import {
  getCostReductionTarget,
  getRampRoles,
  inkLandsOffTriggerTurn,
  isDeckRamp,
  isRampCard,
  isRepeatingTrigger,
} from '../utils';
import {getRuleById} from '../engine';
import {createCard} from './fixtures';
import type {LorcanaCard} from '../types';

describe('Ramp', () => {
  const rampRule = getRuleById('ramp')!;

  // ── Inkwell Ramp (deck ramp) ──
  const mamaOdie = createCard({
    id: 'mama-odie',
    name: 'Mama Odie',
    fullName: 'Mama Odie - Mystical Maven',
    ink: 'Sapphire',
    cost: 3,
    text: 'THIS GOING TO BE GOOD Whenever you play a song,\nyou may put the top card of your deck into your inkwell\nfacedown and exerted.',
  });

  const oneJumpAhead = createCard({
    id: 'one-jump',
    name: 'One Jump Ahead',
    fullName: 'One Jump Ahead',
    type: 'Action',
    ink: 'Sapphire',
    cost: 2,
    text: '(A character with cost 2 or more can ⟳ to sing this song\nfor free.)\nPut the top card of your deck into your inkwell facedown\nand exerted.',
  });

  // ── Inkwell Ramp (self-sacrifice) ──
  const winniePooh = createCard({
    id: 'winnie',
    name: 'Winnie the Pooh',
    fullName: 'Winnie the Pooh - Having a Think',
    ink: 'Sapphire',
    cost: 3,
    text: 'HUNNY POT Whenever this character quests, you may put a card from your hand into your inkwell facedown.',
  });

  // ── Inkwell Triggers (repeating) ──
  const jafar = createCard({
    id: 'jafar',
    name: 'Jafar',
    fullName: 'Jafar - Power-Hungry Vizier',
    ink: 'Steel',
    cost: 5,
    text: "YOU'LL GET WHAT'S COMING TO YOU During your turn,\nwhenever a card is put into your inkwell, deal 1 damage\nto chosen character.",
  });

  const amberCoil = createCard({
    id: 'amber-coil',
    name: 'Amber Coil',
    fullName: 'Amber Coil',
    type: 'Item',
    ink: 'Amber',
    cost: 1,
    text: 'HEALING AURA During your turn, whenever a card is\nput into your inkwell, you may remove up to 2 damage\nfrom chosen character.',
  });

  // ── Inkwell Triggers (once per turn) ──
  const rayaKumandran = createCard({
    id: 'raya',
    name: 'Raya',
    fullName: 'Raya - Kumandran Rider',
    ink: 'Ruby',
    cost: 4,
    text: "COME ON, LET'S DO THIS Once during your turn,\nwhenever a card is put into your inkwell, you may\nready another chosen character of yours.",
  });

  // ── Cost Reduction Grants ──
  const pluto = createCard({
    id: 'pluto',
    name: 'Pluto',
    fullName: 'Pluto - Friendly Pooch',
    ink: 'Amber',
    cost: 1,
    text: 'GOOD DOG ⟳ — You pay 1 ⬡ less for the next\ncharacter you play this turn.',
  });

  const lantern = createCard({
    id: 'lantern',
    name: 'Lantern',
    fullName: 'Lantern',
    type: 'Item',
    ink: 'Amber',
    cost: 2,
    text: 'BIRTHDAY LIGHTS ⟳ — You pay 1 ⬡ less for the next\ncharacter you play this turn.',
  });

  // ── Opponent Ink (should be EXCLUDED) ──
  const hideAway = createCard({
    id: 'hide-away',
    name: 'Hide Away',
    fullName: 'Hide Away',
    type: 'Action',
    ink: 'Sapphire',
    cost: 2,
    text: "Put chosen item or location into its player's inkwell\nfacedown and exerted.",
  });

  const wipeOut = createCard({
    id: 'wipe-out',
    name: 'Wipe Out!',
    fullName: 'Wipe Out!',
    type: 'Action',
    ink: 'Sapphire',
    cost: 2,
    text: "Put chosen character with Bodyguard or item into their player's inkwell facedown and exerted.",
  });

  // ── Self-discount (should be EXCLUDED) ──
  const kristoff = createCard({
    id: 'kristoff',
    name: 'Kristoff',
    fullName: 'Kristoff - Reindeer Keeper',
    ink: 'Amber',
    cost: 9,
    text: 'SONG OF THE HERD For each song card in your\ndiscard, you pay 1 ⬡ less to play this character.',
  });

  // ── Cost Reduction (location — different target type) ──
  const elsaConcerned = createCard({
    id: 'elsa-concerned',
    name: 'Elsa',
    fullName: 'Elsa - Concerned Sister',
    ink: 'Ruby',
    cost: 3,
    text: 'CLEAR THE WAY When you play this character, you pay 2 ⬡ less for the next location you play this turn.',
  });

  // ── Unrelated card ──
  const unrelated = createCard({
    id: 'unrelated',
    name: 'Generic',
    fullName: 'Generic Card',
    cost: 3,
    text: 'Draw a card.',
  });

  // ── Variant wording triggers ──
  const fgWand = createCard({
    id: 'fg-wand',
    name: "Fairy Godmother's Wand",
    fullName: "Fairy Godmother's Wand",
    type: 'Item',
    ink: 'Sapphire',
    cost: 2,
    text: 'ONLY TILL MIDNIGHT During your turn, whenever you\nput a card into your inkwell, chosen Princess character\nof yours gains Ward until the start of your next turn.',
  });

  // ── Role Detection ──

  it('should detect deck ramp cards', () => {
    expect(getRampRoles(mamaOdie)).toContain('inkwell-ramp');
    expect(getRampRoles(oneJumpAhead)).toContain('inkwell-ramp');
    expect(isDeckRamp(mamaOdie)).toBe(true);
    expect(isDeckRamp(oneJumpAhead)).toBe(true);
  });

  it('should detect self-sacrifice ramp cards', () => {
    expect(getRampRoles(winniePooh)).toContain('inkwell-ramp');
    expect(isDeckRamp(winniePooh)).toBe(false);
  });

  it('should detect repeating inkwell triggers', () => {
    expect(getRampRoles(jafar)).toContain('inkwell-trigger');
    expect(getRampRoles(amberCoil)).toContain('inkwell-trigger');
    expect(isRepeatingTrigger(jafar)).toBe(true);
    expect(isRepeatingTrigger(amberCoil)).toBe(true);
  });

  it('should detect once-per-turn inkwell triggers', () => {
    expect(getRampRoles(rayaKumandran)).toContain('inkwell-trigger');
    expect(isRepeatingTrigger(rayaKumandran)).toBe(false);
  });

  it('should detect variant wording triggers', () => {
    expect(getRampRoles(fgWand)).toContain('inkwell-trigger');
  });

  it('should detect cost reduction grants', () => {
    expect(getRampRoles(pluto)).toContain('cost-reduction');
    expect(getRampRoles(lantern)).toContain('cost-reduction');
  });

  it('should detect cost reduction target types', () => {
    expect(getCostReductionTarget(pluto)).toBe('character');
    expect(getCostReductionTarget(lantern)).toBe('character');
    expect(getCostReductionTarget(elsaConcerned)).toBe('location');
  });

  it('should exclude opponent-ink cards', () => {
    expect(isRampCard(hideAway)).toBe(false);
    expect(isRampCard(wipeOut)).toBe(false);
  });

  it('should exclude self-discount payoffs', () => {
    expect(isRampCard(kristoff)).toBe(false);
  });

  it('should not match unrelated cards', () => {
    expect(isRampCard(unrelated)).toBe(false);
  });

  // ── Scoring ──

  it('should score deck ramp + repeating trigger at 9', () => {
    const synergies = rampRule.findSynergies(mamaOdie, [mamaOdie, jafar]);
    expect(synergies[0].score).toBe(9);
  });

  it('should score deck ramp + once-per-turn trigger at 8', () => {
    const synergies = rampRule.findSynergies(oneJumpAhead, [oneJumpAhead, rayaKumandran]);
    expect(synergies[0].score).toBe(8);
  });

  it('should score self-sacrifice + repeating trigger at 8', () => {
    const synergies = rampRule.findSynergies(winniePooh, [winniePooh, jafar]);
    expect(synergies[0].score).toBe(8);
  });

  it('should score self-sacrifice + once-per-turn trigger at 7', () => {
    const synergies = rampRule.findSynergies(winniePooh, [winniePooh, rayaKumandran]);
    expect(synergies[0].score).toBe(7);
  });

  it('ramp ↔ ramp scores 5 (parallel ramp, no compounding)', () => {
    const synergies = rampRule.findSynergies(mamaOdie, [mamaOdie, oneJumpAhead]);
    expect(synergies[0].score).toBe(5);
  });

  it('ramp ↔ cost reduction scores 5 (parallel curve acceleration)', () => {
    const synergies = rampRule.findSynergies(mamaOdie, [mamaOdie, pluto]);
    expect(synergies[0].score).toBe(5);
  });

  it('trigger ↔ trigger scores 5 (parallel triggers, both need ramp to fire)', () => {
    const synergies = rampRule.findSynergies(jafar, [jafar, amberCoil]);
    expect(synergies[0].score).toBe(5);
  });

  it('should score cost reduction + cost reduction at 6 when same target type', () => {
    const synergies = rampRule.findSynergies(pluto, [pluto, lantern]);
    expect(synergies[0].score).toBe(6);
  });

  it('should not pair cost reduction cards that discount different types', () => {
    // Pluto discounts characters, Elsa discounts locations — no synergy
    const synergies = rampRule.findSynergies(pluto, [pluto, elsaConcerned]);
    expect(synergies).toHaveLength(0);
  });

  it('should score trigger + cost reduction at 5', () => {
    const synergies = rampRule.findSynergies(amberCoil, [amberCoil, pluto]);
    expect(synergies[0].score).toBe(5);
  });

  // ── Integration ──

  it('should not find synergies with unrelated cards', () => {
    const synergies = rampRule.findSynergies(mamaOdie, [mamaOdie, unrelated]);
    expect(synergies).toHaveLength(0);
  });

  it('should not find synergies for opponent-ink cards', () => {
    const synergies = rampRule.findSynergies(hideAway, [hideAway, jafar, pluto]);
    expect(synergies).toHaveLength(0);
  });

  it('should generate non-empty mechanic-level explanations', () => {
    // Card-name interpolation was removed in favor of mechanic-focused copy
    // (modal context provides identity via the visible cards). Assert the
    // explanation is present and references ink/inkwell mechanics.
    const synergies = rampRule.findSynergies(mamaOdie, [mamaOdie, jafar]);
    expect(synergies[0].explanation.length).toBeGreaterThan(0);
    expect(synergies[0].explanation).toMatch(/ink|inkwell/i);
  });

  it('should mark all matches as bidirectional', () => {
    const synergies = rampRule.findSynergies(mamaOdie, [mamaOdie, jafar, pluto]);
    synergies.forEach((s) => expect(s.bidirectional).toBe(true));
  });
});

// Fixes from the 2026-10-14 misread review. Real card text.

const rampRule = getRuleById('ramp')!;
/** The Ramp pair `card` finds with `partner`, or undefined when they do not pair. */
const rampPair = (card: LorcanaCard, partner: LorcanaCard) =>
  rampRule.findSynergies(card, [card, partner]).find((s) => s.card.id === partner.id);

// Discounts for the cards of one name.
const munchings = createCard({
  id: 'munchings-and-crunchings',
  name: 'Munchings and Crunchings',
  fullName: 'Munchings and Crunchings',
  type: 'Item',
  text: 'WHAT A JUICY APPLE ⟳ — Remove up to 2 damage\nfrom chosen character.\nCOME ON OUT You pay 1 ⬡ less to play characters\nnamed Gurgi.',
});
const carl = createCard({
  id: 'carl-fredricksen-loving-husband',
  name: 'Carl Fredricksen',
  fullName: 'Carl Fredricksen - Loving Husband',
  ink: 'Emerald',
  text: 'TAKE MY HAND When you play this character, you\npay 2 ⬡ less for the next character named Ellie\nFredricksen you play this turn.',
});
const pluto = createCard({
  id: 'pluto-friendly-pooch',
  name: 'Pluto',
  fullName: 'Pluto - Friendly Pooch',
  text: 'GOOD DOG ⟳ — You pay 1 ⬡ less for the next\ncharacter you play this turn.',
});

describe('Ramp: a discount for the cards of one name', () => {
  it('reads no cost reduction from it', () => {
    expect(getRampRoles(munchings)).toEqual([]);
    expect(getRampRoles(carl)).toEqual([]);
    expect(getRampRoles(pluto)).toEqual(['cost-reduction']);
  });

  it('does not pair it with a general discount', () => {
    expect(rampPair(carl, pluto)).toBeUndefined();
    expect(rampPair(pluto, munchings)).toBeUndefined();
  });
});

// Ink that lands on the opponent's turn, and inkwell triggers that fire only on yours.
const inkAmplifier = createCard({
  id: 'ink-amplifier',
  name: 'Ink Amplifier',
  fullName: 'Ink Amplifier',
  type: 'Item',
  ink: 'Sapphire',
  text: "ENERGY CAPTURE Whenever an opponent draws a card\nduring their turn, if it's the second card they've drawn\nthis turn, you may put the top card of your deck into\nyour inkwell facedown and exerted.",
});
const scrooge = createCard({
  id: 'scrooge-mcduck-miserly-ebenezer',
  name: 'Scrooge McDuck',
  fullName: 'Scrooge McDuck - Miserly Ebenezer',
  ink: 'Sapphire',
  text: 'BAH, HUMBUG During your turn, whenever a\ncard is put into your inkwell, chosen character\ngets -1 ¤ this turn.',
});
const chiefTui = createCard({
  id: 'chief-tui-weaving-a-tale',
  name: 'Chief Tui',
  fullName: 'Chief Tui - Weaving a Tale',
  ink: 'Sapphire',
  text: 'AND THEN... Once during your turn, whenever a card\nis put into your inkwell, look at the top card of your\ndeck. You may put it on either the top or the bottom of\nyour deck.',
});
const mamaOdie = createCard({
  id: 'mama-odie-mystical-maven',
  name: 'Mama Odie',
  fullName: 'Mama Odie - Mystical Maven',
  ink: 'Sapphire',
  text: 'THIS GOING TO BE GOOD Whenever you play a song,\nyou may put the top card of your deck into your inkwell\nfacedown and exerted.',
});

describe("Ramp: ink that lands on the turn a trigger can't fire", () => {
  it('reads when the ramp and the trigger fall on different turns', () => {
    expect(inkLandsOffTriggerTurn(inkAmplifier, scrooge)).toBe(true);
    expect(inkLandsOffTriggerTurn(inkAmplifier, chiefTui)).toBe(true);
    expect(inkLandsOffTriggerTurn(mamaOdie, scrooge)).toBe(false);
  });

  it('scores the pair at 5, from either side', () => {
    const pairs = [scrooge, chiefTui].flatMap((trigger) => [
      rampPair(inkAmplifier, trigger),
      rampPair(trigger, inkAmplifier),
    ]);
    for (const pair of pairs) {
      expect(pair).toMatchObject({score: 5, explanation: '{A} and {B} both go in a Ramp deck.'});
    }
  });

  it('keeps the chain for ramp on your own turn', () => {
    expect(rampPair(mamaOdie, scrooge)?.score).toBe(9);
    expect(rampPair(mamaOdie, chiefTui)?.score).toBe(8);
  });
});

// A trigger whose keyword lasts until your next turn: a second ink that turn gives Ward to a
// Princess that already has it.
const fairyGodmothersWand = createCard({
  id: 'fairy-godmothers-wand',
  name: "Fairy Godmother's Wand",
  fullName: "Fairy Godmother's Wand",
  type: 'Item',
  ink: 'Sapphire',
  text: 'ONLY TILL MIDNIGHT During your turn, whenever you\nput a card into your inkwell, chosen Princess character\nof yours gains Ward until the start of your next turn.',
});
const winnieThePooh = createCard({
  id: 'winnie-the-pooh-having-a-think',
  name: 'Winnie the Pooh',
  fullName: 'Winnie the Pooh - Having a Think',
  ink: 'Sapphire',
  text: 'HUNNY POT Whenever this character quests, you may\nput a card from your hand into your inkwell facedown.',
});

describe('Ramp: a trigger that grants a lasting keyword', () => {
  it('reads as once per turn', () => {
    expect(getRampRoles(fairyGodmothersWand)).toEqual(['inkwell-trigger']);
    expect(isRepeatingTrigger(fairyGodmothersWand)).toBe(false);
    expect(isRepeatingTrigger(scrooge)).toBe(true);
  });

  it('scores one tier below a repeating trigger', () => {
    expect(rampPair(mamaOdie, fairyGodmothersWand)?.score).toBe(8);
    expect(rampPair(winnieThePooh, fairyGodmothersWand)?.score).toBe(7);
    expect(rampPair(winnieThePooh, scrooge)?.score).toBe(8);
  });
});

// Ramps from the discard; the Boost reminder before it puts a card under him, not into your inkwell.
const jiminyAbility =
  'LOOK INTO YOUR PAST Whenever you put a card\nunder this character, you may put a card from your\ndiscard into your inkwell facedown and exerted.';
const jiminy = createCard({
  id: 'jiminy-cricket-ghost-of-christmas-past',
  name: 'Jiminy Cricket',
  fullName: 'Jiminy Cricket - Ghost of Christmas Past',
  ink: 'Sapphire',
  text: `Boost 2 ⬡ (Once during your turn, you may pay 2 ⬡\nto put the top card of your deck facedown under this\ncharacter.)\n${jiminyAbility}`,
});

describe('Ramp: a card put into your inkwell from your discard', () => {
  it('reads ramp from that clause, not from the Boost reminder', () => {
    expect(getRampRoles({...jiminy, text: jiminyAbility})).toEqual(['inkwell-ramp']);
    expect(getRampRoles(jiminy)).toEqual(['inkwell-ramp']);
  });
});

// A deck look whose own cards go into your inkwell, and one whose look plays a card for free
// before the item puts itself into your inkwell.
const whatElse = createCard({
  id: 'what-else-can-i-do',
  name: 'What Else Can I Do?',
  fullName: 'What Else Can I Do?',
  type: 'Action',
  ink: 'Sapphire',
  text: "(A character with cost 5 or more can ⟳ to sing this song\nfor free.)\nLook at the top 2 cards of your deck. Put one into your hand\nand the other into your inkwell facedown and exerted. If a\ncharacter sang this song, your characters gain Ward until the\nstart of your next turn. (Opponents can't choose them except\nto challenge.)",
});
const closetDoorPortal = createCard({
  id: 'closet-door-portal',
  name: 'Closet Door Portal',
  fullName: 'Closet Door Portal',
  type: 'Item',
  ink: 'Sapphire',
  text: "KNOCK, KNOCK This item enters play exerted.\nWHO'S THERE? ⟳, 2 ⬡ — Look at the top 3 cards of\nyour deck. You may reveal a character, item, or location\ncard with cost 6 or less and play it for free. Put the rest\non the bottom of your deck in any order. Put this card\ninto your inkwell facedown and exerted.",
});

describe('Ramp: a deck look that puts a card into your inkwell', () => {
  it('reads deck ramp only from ink that comes from the look', () => {
    expect(isDeckRamp(whatElse)).toBe(true);
    expect(isDeckRamp(closetDoorPortal)).toBe(false);
    expect(getRampRoles(closetDoorPortal)).toEqual(['inkwell-ramp']);
  });

  it('scores a card that puts itself into your inkwell in the self-sacrifice tier', () => {
    expect(rampPair(closetDoorPortal, scrooge)?.score).toBe(8);
    expect(rampPair(closetDoorPortal, chiefTui)?.score).toBe(7);
    expect(rampPair(whatElse, scrooge)?.score).toBe(9);
  });
});
