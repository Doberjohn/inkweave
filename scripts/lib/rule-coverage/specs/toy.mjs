import {pairsLead, poolLine, roleTable, section, shapeTable} from '../blocks.mjs';
import {fmt} from '../render.mjs';
import {holders} from '../stats.mjs';
import {TOY_ROLES} from './roles.mjs';

/**
 * The pair shapes. A 7 reads by what each card's text counts, the same for two tribal payoffs as
 * for a member and one, so the tribal ↔ tribal row checks the roles instead of the words. A
 * tribal pair whose texts count neither card scores 5, and only such a pair puts a tribal card
 * beside a member or another tribal card at 5.
 */
function toyShapes(engine) {
  const roles = (card) => engine.getToyRoles(card);
  const tribal = (card) => roles(card).some((role) => engine.TOY_TRIBAL_ROLES.includes(role));
  const memberOrTribal = (card) => roles(card).includes('member') || tribal(card);
  return [
    {label: 'member ↔ search', score: 8, test: /fetches .* from the deck/},
    {label: 'search ↔ banish-trigger', score: 8, test: /loads a Toy/},
    {label: 'tribal ↔ tribal', score: 7, test: (pair) => pair.cards.every(tribal)},
    {label: 'member ↔ tribal', score: 7, test: /can activate .+'s Toy ability/},
    {
      label: 'tribal ↔ member or tribal, no text counting the other card',
      score: 5,
      test: (pair) => pair.cards.some(tribal) && pair.cards.every(memberOrTribal),
    },
    {
      label: 'member ↔ member, member ↔ generic, generic ↔ generic',
      score: 5,
      test: /both go in a Toys deck/,
    },
  ];
}

const LABELS = {
  burn: 'burn (Lore Denial)',
  steal: 'steal (Lore Denial)',
  targeted: 'targeted (Discard)',
  random: 'random (Discard)',
  standard: 'standard (Discard)',
  'inkwell-ramp': 'inkwell-ramp (Ramp)',
  'inkwell-trigger': 'inkwell-trigger (Ramp)',
  'cost-reduction': 'cost-reduction (Ramp)',
};

export default {
  doc: 'TOY_RULE.md',
  blocks: {
    distribution: (coverage) => {
      const roles = coverage.roles(coverage.engine.getToyRoles, TOY_ROLES);
      const pairs = coverage.pairs('toy');
      return section(
        poolLine(coverage),
        `**${fmt(holders(roles).length)} Toy-affiliated cards**. ${pairsLead(pairs)}:`,
        shapeTable(pairs, toyShapes(coverage.engine)),
        'Role population (roles no card holds are left out):',
        roleTable(roles, {names: 6, inks: coverage.inks, labels: LABELS, hideEmpty: true}),
      );
    },
  },
};
