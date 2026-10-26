/**
 * Coverage numbers for the synergy-rule docs (#479), computed from the live engine rather than
 * read from the precomputed JSON: the per-card files cap each group at the engine's
 * maxResultsPerGroup (100), so they miss pairs between two cards whose groups are both full.
 */

/** Card ids are numeric strings; order them as numbers, so "the lower id" means what it says. */
export const byId = (a, b) => Number(a.id) - Number(b.id) || a.id.localeCompare(b.id);

/** Cards by full name, then id. */
export const byName = (a, b) => a.fullName.localeCompare(b.fullName) || byId(a, b);

const setCodes = (cards) => [...new Set(cards.map((c) => c.setCode))].sort((a, b) => a - b);

/** "9-13" for a contiguous run of set codes, else "9, 11". */
function setRange(codes) {
  const contiguous = codes.every((code, i) => i === 0 || Number(code) === Number(codes[i - 1]) + 1);
  return contiguous && codes.length > 1 ? `${codes[0]}-${codes.at(-1)}` : codes.join(', ');
}

/** "sets 9-13 plus the Set 14 preview": the sets the pool spans, the way the docs name them. */
function poolLabel(mainCodes, previewCodes) {
  const main = `${mainCodes.length === 1 ? 'set' : 'sets'} ${setRange(mainCodes)}`;
  if (previewCodes.length === 0) return main;
  const previews = previewCodes.length === 1 ? 'preview' : 'previews';
  return `${main} plus the Set ${previewCodes.join(' and ')} ${previews}`;
}

/**
 * The Core pool exactly as precompute-synergies.mjs builds it: allCards.json plus the preview
 * cards it lacks (allCards.json wins on an id), cut to Core sets, then run through the engine's
 * transformer.
 *
 * @param {{main: object, preview: object | null, engine: object}} input
 */
export function buildPool({main, preview, engine}) {
  const mainIds = new Set(main.cards.map((c) => c.id));
  const core = (cards) => cards.filter((c) => engine.isCoreSet(c.setCode));
  const mainCards = core(main.cards);
  const previewCards = core((preview?.cards ?? []).filter((c) => !mainIds.has(c.id)));
  const raw = [...mainCards, ...previewCards];
  const mainCodes = setCodes(mainCards);
  const previewCodes = setCodes(previewCards).filter((code) => !mainCodes.includes(code));
  const sets = {...preview?.sets, ...main.sets};
  return {
    cards: engine.transformCards(raw),
    /** Raw records by the transformed card's id (a string; the raw id may be a number). */
    raw: new Map(raw.map((c) => [String(c.id), c])),
    label: poolLabel(mainCodes, previewCodes),
    setName: (code) => sets[code]?.name ?? `Set ${code}`,
  };
}

/** The two cards of a pair, lower id first, and the key that names the pair. */
export function pairOf(card, other) {
  const cards = [card, other].sort(byId);
  return {key: `${cards[0].id}:${cards[1].id}`, cards};
}

/** A higher score wins; on a tie, the reading from the lower-id searcher. */
const beats = (pair, held) =>
  pair.score > held.score || (pair.score === held.score && byId(pair.searcher, held.searcher) < 0);

function keepBest(pairs, pair) {
  const held = pairs.get(pair.key);
  if (!held || beats(pair, held)) pairs.set(pair.key, pair);
}

/**
 * One rule's pairs and partners. A pair is two cards the rule pairs from either side, with the
 * best of the two readings. Partners are what each card's own page lists for the rule.
 *
 * @param {object} rule - a SynergyRule
 * @param {{cards: object[], compatible: (card: object) => object[]}} pool
 */
function collectRule(rule, {cards, compatible}) {
  const pairs = new Map();
  const partners = new Map();
  for (const card of cards.filter((c) => rule.matches(c))) {
    const matches = rule.findSynergies(card, compatible(card));
    if (matches.length > 0) partners.set(card.id, new Set(matches.map((m) => m.card.id)));
    for (const {card: other, score, explanation} of matches) {
      keepBest(pairs, {
        ...pairOf(card, other),
        searcher: card,
        score,
        explanation,
        ruleId: rule.id,
      });
    }
  }
  return {pairs, partners};
}

/**
 * Every rule's pairs over the pool, after the engine's ink filter (`canShareDeck`), the way
 * SynergyEngine.findSynergies sees them, minus its display cap.
 *
 * @param {{engine: object, cards: object[]}} input
 * @returns {Map<string, {pairs: Map<string, object>, partners: Map<string, Set<string>>}>}
 */
export function collectPairs({engine, cards}) {
  const compatibleById = new Map();
  const compatible = (card) => {
    if (!compatibleById.has(card.id)) {
      compatibleById.set(
        card.id,
        cards.filter((other) => engine.canShareDeck(card, other)),
      );
    }
    return compatibleById.get(card.id);
  };
  return new Map(
    engine.getAllRules().map((rule) => [rule.id, collectRule(rule, {cards, compatible})]),
  );
}

/**
 * Cards grouped by the roles a role helper gives them, each group sorted by name. Every role
 * the helper returns must be in `order`, so a new role fails the run instead of going uncounted.
 *
 * @param {object[]} cards
 * @param {(card: object) => string[]} roleFn
 * @param {string[]} order - every role, in display order
 * @returns {Map<string, object[]>}
 */
export function groupByRole(cards, roleFn, order) {
  const groups = new Map(order.map((role) => [role, []]));
  for (const card of cards) {
    for (const role of new Set(roleFn(card))) {
      if (!groups.has(role)) throw new Error(`role "${role}" is missing from the coverage spec`);
      groups.get(role).push(card);
    }
  }
  for (const group of groups.values()) group.sort(byName);
  return groups;
}

/**
 * The distinct cards holding any of the given roles, sorted by name.
 *
 * @param {Map<string, object[]>} groups - from groupByRole
 * @param {string[]} [roles] - every role when left out
 */
export const holders = (groups, roles = [...groups.keys()]) =>
  [...new Set(roles.flatMap((role) => groups.get(role)))].sort(byName);

/**
 * A pair's two cards in the order its explanation names them. An explanation names the searcher
 * {A} and the partner {B}, so one that opens with {B} names the partner first.
 *
 * @param {{cards: object[], searcher: object, explanation: string}} pair
 * @returns {[object, object]}
 */
export function namedOrder(pair) {
  const partner = pair.cards[0] === pair.searcher ? pair.cards[1] : pair.cards[0];
  return pair.explanation.startsWith('{B}') ? [partner, pair.searcher] : [pair.searcher, partner];
}

/** The card an explanation token names: {A} is the searcher, {B} the partner. */
export function tokenCard(pair, token) {
  if (token === '{A}') return pair.searcher;
  return pair.cards[0] === pair.searcher ? pair.cards[1] : pair.cards[0];
}

/**
 * A pattern matching the explanations a tunable template produces (tuning.json), so a spec
 * follows the template instead of copying it. Each {PLACEHOLDER} matches the {A} or {B} token
 * it is filled with and captures it as a named group. A placeholder the template names again
 * (admin's tuning editor allows it) matches the same token there.
 *
 * @param {string} template - "{RAMP} adds ink to your inkwell, triggering {TRIGGER}'s inkwell effect."
 * @returns {RegExp}
 */
export function templatePattern(template) {
  const escaped = template.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const named = new Set();
  const placeholder = (_, name) => {
    if (named.has(name)) return `\\k<${name}>`;
    named.add(name);
    return `(?<${name}>\\{[AB]\\})`;
  };
  return new RegExp(`^${escaped.replace(/\\\{([A-Z]+)\\\}/g, placeholder)}$`);
}

/**
 * The distinct cards an explanation names first (slot 0) or second (slot 1), across pairs, sorted
 * by name: the actors of a combo, or what they act on.
 *
 * @param {object[]} pairs
 * @param {0 | 1} slot
 */
export const namedIn = (pairs, slot) =>
  [...new Set(pairs.map((pair) => namedOrder(pair)[slot]))].sort(byName);

/**
 * How many pairs score each score, highest score first.
 *
 * @param {object[]} pairs
 * @returns {Array<[number, number]>}
 */
export function scoreCounts(pairs) {
  const counts = new Map();
  for (const {score} of pairs) counts.set(score, (counts.get(score) ?? 0) + 1);
  return [...counts].sort((a, b) => b[0] - a[0]);
}

/**
 * The coverage context the doc specs read: the pool, the engine, and pairs by rule id.
 *
 * @param {{engine: object, pool: ReturnType<typeof buildPool>}} input
 */
export function createCoverage({engine, pool}) {
  const byRule = collectPairs({engine, cards: pool.cards});
  const cardsById = new Map(pool.cards.map((card) => [card.id, card]));
  const ruleData = (ruleId) => {
    const data = byRule.get(ruleId);
    if (!data) throw new Error(`no rule "${ruleId}" in the engine`);
    return data;
  };
  return {
    engine,
    pool,
    /** Pairs across one or more rules, the best reading of each, sorted by key. */
    pairs(...ruleIds) {
      const merged = new Map();
      for (const ruleId of ruleIds) {
        for (const pair of ruleData(ruleId).pairs.values()) keepBest(merged, pair);
      }
      return [...merged.values()].sort(
        (a, b) => byId(a.cards[0], b.cards[0]) || byId(a.cards[1], b.cards[1]),
      );
    },
    /** Each card's partners across one or more rules: what its own page lists. */
    partners(...ruleIds) {
      const merged = new Map();
      for (const ruleId of ruleIds) {
        for (const [id, ids] of ruleData(ruleId).partners)
          merged.set(id, new Set([...(merged.get(id) ?? []), ...ids]));
      }
      return merged;
    },
    roles: (roleFn, order) => groupByRole(pool.cards, roleFn, order),
    /** The pool card with this id. */
    card: (id) => cardsById.get(id),
    /** How many pairs of two different cards, one from each list, can share a deck. */
    compatiblePairs(cardsA, cardsB = cardsA) {
      const keys = new Set();
      for (const a of cardsA) {
        for (const b of cardsB.filter(
          (other) => other.id !== a.id && engine.canShareDeck(a, other),
        )) {
          keys.add(pairOf(a, b).key);
        }
      }
      return keys.size;
    },
    /** A card's inks, one entry each. */
    inks: (card) => engine.getInks(card),
  };
}
