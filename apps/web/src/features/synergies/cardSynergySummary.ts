import type {LorcanaCard, SynergyGroup} from 'inkweave-synergy-engine';

/**
 * Builds a 1-2 sentence, per-card-UNIQUE synergy narrative for a card page (#498 Phase 2).
 *
 * This is the SEO/AEO differentiator: it frames the card's place in the 16,511-pair synergy
 * graph in prose no other Lorcana database has, so the page reads as non-thin content and ranks
 * for "[card] synergies" intent. It must NOT restate the card's rules text — that is duplicate
 * boilerplate across every Lorcana DB and adds no unique value.
 *
 * Used as the card page's `<meta name="description">` (CardPage falls back to the generic
 * description when this returns ''). Not rendered visibly — the win is a unique, keyword-rich
 * SERP snippet per card, not on-page text.
 *
 * Data available (all already loaded on the page, no fetching):
 *   - `card`   : the LorcanaCard — card.fullName, card.name, card.cost, card.ink, card.type, ...
 *   - `groups` : SynergyGroup[] the card belongs to. Each group has:
 *                  - label     e.g. "Lore Denial", "Shift Targets", "Ramp"
 *                  - category  'direct' (a specific pair rule) | 'playstyle' (an archetype)
 *                  - tagline   a short human phrase for the group
 *                  - synergies SynergyMatchDisplay[], each with:
 *                      - card   the PARTNER LorcanaCard (so the partner's name is `.card.fullName`)
 *                      - score  1-10
 *
 * The SHAPE we're after (templated — the wording is your design decision):
 *   "{card} anchors {N} {ArchetypeA}/{ArchetypeB} synergies in Core, its strongest partner
 *    being {partner} ({score}/10)."
 *   "A cornerstone of the {Archetype} archetype, {card} pairs with {N} cards to {short effect}."
 *
 * Keep it factual and derived from the data (no invented claims), under ~2 sentences. Return ''
 * when the card has no meaningful synergies, so CardPage uses the generic description instead.
 */
export function cardSynergySummary(card: LorcanaCard, groups: SynergyGroup[]): string {
  if (groups.length === 0) return '';

  const {count, top} = collectPartners(groups);
  if (count === 0 || !top) return '';

  // Archetypes (playstyle groups) the card belongs to, most-connected first — the SEO terms.
  // .filter() returns a fresh array, so the .sort() never mutates the shared `groups`.
  const archetypes = groups
    .filter((g) => g.category === 'playstyle')
    .sort((a, b) => b.synergies.length - a.synergies.length)
    .map((g) => g.label);

  const cards = count === 1 ? '1 card' : `${count} cards`;
  return `In Core Lorcana, ${card.fullName} pairs with ${cards}${archetypeClause(archetypes)}, anchored by ${top.name} (${top.score}/10).`;
}

/** Names up to two archetypes the card spans; empty when it belongs to none (direct rules only). */
function archetypeClause(labels: string[]): string {
  if (labels.length === 0) return '';
  if (labels.length === 1) return ` within the ${labels[0]} archetype`;
  if (labels.length === 2) return ` across the ${labels[0]} and ${labels[1]} archetypes`;
  return ` across ${labels.length} archetypes, chiefly ${labels[0]} and ${labels[1]}`;
}

interface TopPartner {
  name: string;
  score: number;
}

/** Unique synergy-partner count across all groups + the single highest-scoring pairing. */
function collectPartners(groups: SynergyGroup[]): {count: number; top: TopPartner | null} {
  const partnerIds = new Set<string>();
  let top: TopPartner | null = null;
  for (const group of groups) {
    for (const match of group.synergies) {
      partnerIds.add(match.card.id);
      if (!top || match.score > top.score) top = {name: match.card.fullName, score: match.score};
    }
  }
  return {count: partnerIds.size, top};
}
