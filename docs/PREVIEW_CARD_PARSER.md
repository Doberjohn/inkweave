# Preview Card Parser (browser-console snippet)

A copy-paste devtools snippet that scrapes a **single** Lorcana card-detail page
(e.g. a `lorcanaplayer.com` reveal page) into the `LorcanaJSONCard` shape used by
[`apps/web/public/data/previewCards.json`](../apps/web/public/data/previewCards.json).
Use it during **reveal season** to turn a freshly-revealed card into a
ready-to-paste JSON entry before LorcanaJSON.org publishes the canonical set.

> **Why this lives in a doc, not `scripts/`** — it's a browser-console tool, not
> part of the Node build pipeline (nothing in the repo imports it). Keeping it as
> a fenced code block means it's versioned and discoverable without being gated as
> build/runtime source. To use it, copy the whole block below into the console.

## How to use

1. Open a card-detail page (one whose DOM has a `.card-details` container).
2. Open devtools → Console, paste the entire snippet below, press Enter.
3. It auto-runs: logs the parsed card, copies the JSON to your clipboard, and
   downloads `{id}-{slug}.json`.
4. Resolve the set: add the set's display name → numeric code to `SET_NAME_TO_CODE`
   each reveal season, or call `parseLorcanaCard(document, {setCode: '13'})` directly.
5. Read the `[parse]` console warnings — they flag unmapped symbols, a missing
   `setCode`/`cost`, a synthesized Song reminder to verify, and non-schema fields
   (illustrator / release date) that were dropped off the card.

## After scraping

- Paste the card object into the `cards[]` array of `previewCards.json`. The
  field-by-field contract is the **Preview card schema** collapsible in
  [`CARD_DATA_PIPELINE.md`](CARD_DATA_PIPELINE.md#the-two-source-jsons).
- The parser drops `releaseDate` from the card and logs it — put it in
  `sets["<code>"].releaseDate` (`YYYY-MM-DD`), not on the card.
- `id` is a `setCode`-prefixed composite (`setNum * 1000 + collectorNumber`, e.g.
  Set 13 #1 → `13001`) so it can't collide with the low sequential ids already in
  `allCards.json` (a collision makes the loader silently drop the preview card).

## The snippet

```js
/**
 * parse-preview-card.js — browser-console snippet (NOT a Node build script).
 *
 * Run this in the devtools console on a card-detail page (e.g. lorcanaplayer.com)
 * during reveal season to scrape one card into the LorcanaJSON shape used by
 * apps/web/public/data/previewCards.json.
 *
 * Output conforms to `LorcanaJSONCard` (packages/synergy-engine/src/utils/cardTransformer.ts:7-44).
 * See docs/CARD_DATA_PIPELINE.md → "Preview card schema" for the field-by-field contract.
 *
 * Usage: paste this entire file into the devtools console on a card-detail page.
 * It auto-detects the card, logs it, copies it to the clipboard, and downloads
 * {id}-{slug}.json. The set is resolved from the page via SET_NAME_TO_CODE below
 * (add a line per reveal season), or call parseLorcanaCard(document, {setCode}).
 *
 * Convention notes baked in here (vs. the original parser):
 *   - Optional fields are OMITTED when absent, never set to null.
 *   - `setCode` is the numeric set code as a string ("13"), not the display name.
 *   - `id` / `number` are real numbers (the old code reused Card ID for both).
 *   - Non-schema fields (illustrator, releaseDate) are stripped off the card and
 *     logged instead — releaseDate belongs in sets["<code>"].releaseDate.
 *   - Song cards get the standard Singer reminder synthesized if the page omits it.
 *
 * Structure: parseLorcanaCard() is a thin orchestrator. The work lives in
 * module-level stages — DOM scraping, ability extraction, identity, pruning,
 * diagnostics — each small enough to read and test in isolation.
 */

// Map a scraped set *name* → numeric set code. Extend per reveal season,
// or just pass opts.setCode and ignore this.
const SET_NAME_TO_CODE = {
  'The Wilds Unknown': '12',
  'Attack of the Vine!': '13',
  // Add the next set's display name → numeric code each reveal season.
};

const LABELS = new Set([
  'Name', 'Card Type', 'Ink Cost', 'Inkwell', 'Ink Color', 'Rarity', 'Card ID', 'Set',
  'Keywords + Abilities', 'Classifications', 'Card Text', 'Flavor Text', 'Illustrator',
  'Franchise', 'Release Date', 'Revealed', 'Strength', 'Willpower', 'Lore', 'Move Cost',
  'Version', 'Subtitle',
]);

// Lorcana ability text mixes inline symbol <img>s and bold ability names with
// bare text nodes. Map the known symbols to the glyphs canonical allCards.json
// uses (e.g. "pay 3 ⬡"); collect anything unmapped to warn rather than emit a
// wrong glyph. Extend SYMBOLS as new symbols are encountered.
const SYMBOLS = {ink: '⬡', exert: '⟳', lore: '◊', willpower: '⛉'};

// Title-case keywords (matched case-sensitively) — longest first so "Temporary
// Shift" wins over "Shift". Extend as new keywords appear; ALL-CAPS ability
// names (e.g. "PATH OF DESTRUCTION") won't false-match a title-case keyword.
const KEYWORDS = [
  'Temporary Shift', 'Sing Together', 'Bodyguard', 'Challenger', 'Evasive',
  'Reckless', 'Resist', 'Rush', 'Shift', 'Singer', 'Support', 'Vanish', 'Voiceless', 'Ward',
].sort((a, b) => b.length - a.length);

// =====================================================================
// DOM scraping — page → ordered text "leaves" → {label: [values]} map.
// =====================================================================

/** Resolve an inline symbol <img> to its canonical glyph; records misses in `unmapped`. */
function imgSymbol(img, unmapped) {
  const key = (img.getAttribute('alt') || img.getAttribute('title') || '').trim().toLowerCase();
  if (SYMBOLS[key]) return SYMBOLS[key];
  if (key) unmapped.add(key);
  return '';
}

/** Flatten an element's text, mapping inline symbol <img>s to glyphs and <br> to "\n". */
function nodeText(node, unmapped) {
  let out = '';
  for (const n of node.childNodes) {
    if (n.nodeType === 3) { out += n.textContent; continue; }
    if (n.nodeType !== 1) continue;
    if (n.tagName === 'IMG') out += imgSymbol(n, unmapped);
    else if (n.tagName === 'BR') out += '\n';
    else out += nodeText(n, unmapped);
  }
  return out;
}

// An element is a "block" if it has no child elements OR carries its own
// non-whitespace text node — the latter catches ability lines like
// "<strong>NAME</strong> effect <em>(reminder <img>)</em>" that a leaf-only
// walk would otherwise shred down to just the bold name.
const isBlock = (el) =>
  el.children.length === 0 ||
  [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim() !== '');

/** Collect ordered text blocks from the card container, symbols mapped to glyphs. */
function scrapeLeaves(container, unmapped) {
  const leaves = [];
  const walk = (el) => {
    for (const c of el.children) {
      if (!isBlock(c)) { walk(c); continue; }
      const t = nodeText(c, unmapped)
        .replace(/[^\S\n]+/g, ' ')
        .replace(/ *\n */g, '\n')
        .trim();
      if (t) leaves.push(t);
    }
  };
  walk(container);
  return leaves;
}

/** Group ordered leaves into a {label: [values]} map, keyed by the known LABELS. */
function groupFields(leaves) {
  const fields = {};
  let current = null;
  for (const item of leaves) {
    if (LABELS.has(item)) {
      current = item;
      if (!fields[current]) fields[current] = [];
    } else if (current) {
      fields[current].push(item);
    }
  }
  return fields;
}

/** First image URL on the card page (preview cards: one URL serves both sizes). */
function scrapeImage(doc) {
  const imgEl = doc.querySelector('.card-details img, article img');
  return imgEl ? (imgEl.currentSrc || imgEl.src) : '';
}

// =====================================================================
// Ability extraction — keyword abilities → named abilities → reminder
// statics; bare effect blocks produce no entry (canonical omits those).
// Keyword extraction lets the engine detect Shift/Singer/Resist/etc., since
// transformCard reads abilities[] entries whose type === 'keyword'.
// =====================================================================

const isUpperWord = (w) => /[A-Z]/.test(w) && !/[a-z]/.test(w);

function inferType(effect) {
  if (/^(when\b|whenever\b|at the (start|end)\b|once (during|per turn)\b)/i.test(effect)) return 'triggered';
  if (/^[⟳↻]/.test(effect)) return 'activated';
  return 'static';
}

// Match a leading title-case keyword without a dynamic RegExp (avoids the
// non-literal-regexp lint): the block must start with the keyword, followed by a
// word boundary so "Shifty" doesn't match "Shift".
function keywordAbility(text) {
  for (const kw of KEYWORDS) {
    if (!text.startsWith(kw)) continue;
    const after = text[kw.length];
    if (after !== undefined && /\w/.test(after)) continue;
    const value = text.slice(kw.length).split('(')[0].trim(); // "7", "+1", or ""
    return value ? {keyword: kw, value} : {keyword: kw};
  }
  return null;
}

/** Split "NAME effect..." (leading ALL-CAPS run = ability name) → {name, effect} or null. */
function splitNamed(block) {
  const words = block.split(/\s+/);
  let i = 0;
  while (i < words.length && isUpperWord(words[i])) i++;
  if (i < 1 || i >= words.length) return null;
  const nameRun = words.slice(0, i).join(' ');
  if (nameRun.replace(/[^A-Za-z0-9]/g, '').length < 2) return null;
  return {
    name: nameRun.replace(/[\s!?.]+$/, '').trim(),
    effect: words.slice(i).join(' ').replace(/\n/g, ' ').trim(),
  };
}

/** One card-text block → 0 or 1 ability entries (keyword | reminder-static | named). */
function abilityFromBlock(block) {
  const norm = block.replace(/\n/g, ' ').trim();
  const kw = keywordAbility(norm);
  if (kw) {
    const ability = {type: 'keyword', keyword: kw.keyword, fullText: block};
    if (kw.value) ability.keywordValue = kw.value;
    return [ability];
  }
  if (/^\([\s\S]*\)$/.test(block)) {
    return [{effect: norm.replace(/^\(|\)$/g, '').trim(), fullText: block, type: 'static'}];
  }
  const named = splitNamed(block);
  if (named) {
    return [{effect: named.effect, fullText: block, name: named.name, type: inferType(named.effect)}];
  }
  return []; // plain effect block → no ability entry (canonical omits these)
}

const extractAbilities = (textBlocks) => textBlocks.flatMap(abilityFromBlock);

// =====================================================================
// Songs — synthesize the standard Singer reminder if the source page omitted
// it. (Skip Sing Together — its reminder text differs and we can't safely
// guess it.) Mutates textBlocks in place; returns whether it added a reminder.
// =====================================================================

function maybeSynthesizeSongReminder(textBlocks, ctx) {
  const {type, subtypes, cost, rawTextBlocks, keywordsAbilities} = ctx;
  const isSong = type === 'Action' && subtypes.includes('Song');
  if (!isSong || cost == null) return false;
  const hasReminder = textBlocks.some((b) => /sing this song for free/i.test(b));
  const isSingTogether = [...rawTextBlocks, keywordsAbilities].some((b) => /sing together/i.test(b));
  if (hasReminder || isSingTogether) return false;
  textBlocks.unshift(`(A character with cost ${cost} or more can ⟳ to sing this song for free.)`);
  return true;
}

// =====================================================================
// Identity — id/name/version/set resolution. `id` is the pipeline's primary
// key, so deriveCardId() guarantees a unique, collision-safe Number.
// =====================================================================

/** Rarity string, blanked when the page reports unknown/placeholder. */
const cleanRarity = (raw) => (raw && !/unknown/i.test(raw)) ? raw : '';

/** Resolve id/name/version/setCode/number from raw scraped strings + opts. */
function resolveIdentity(raw) {
  const {name, subtitle, setName, cardId, opts} = raw;
  const version = raw.version || subtitle || '';
  const setCode = opts.setCode ?? SET_NAME_TO_CODE[setName] ?? '';
  // Card ID is "129/207" (collector number / set total) — take the first group.
  const cardIdMatch = cardId.match(/\d+/);
  const rawCardId = cardIdMatch ? Number(cardIdMatch[0]) : null;
  const number = opts.number ?? rawCardId ?? undefined;
  const id = opts.id ?? deriveCardId({setCode, number, name, rawCardId, setName});
  return {id, name, version, setName, setCode, number};
}

// =====================================================================
// Pruning — drop keys canonical never emits (null/empty), keep valid
// falsy values (inkwell:false, cost:0).
// =====================================================================

const isPlainObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);

/** True for values canonical never emits: null/undefined, blank string, empty array/object. */
function isEmptyValue(v) {
  if (v == null) return true;
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.length === 0;
  if (isPlainObject(v)) return Object.keys(v).length === 0;
  return false;
}

// Recurse into nested objects BEFORE testing, so an object that becomes empty
// after its children are pruned is itself removed. Sequential guards (no
// else-if nesting) keep this flat — the recursion does the depth, not the loop.
function pruneEmpty(obj) {
  for (const k of Object.keys(obj)) {
    if (isPlainObject(obj[k])) pruneEmpty(obj[k]);
    if (isEmptyValue(obj[k])) delete obj[k];
  }
}

// =====================================================================
// Diagnostics — console warnings/info for fields needing manual attention.
// Not part of the emitted card; split in two so neither trips the
// per-method complexity threshold.
// =====================================================================

/** Warn about identity/cost fields that look missing or wrong. */
function warnMissingFields(out, setName, unmappedSymbols) {
  if (typeof out.id !== 'number' || Number.isNaN(out.id)) {
    console.warn('[parse] id is not a number — implement deriveCardId() or pass opts.id. Got:', out.id);
  }
  if (!out.setCode) console.warn('[parse] setCode unresolved — pass opts.setCode (e.g. "13") or add', JSON.stringify(setName), 'to SET_NAME_TO_CODE.');
  if (!out.color) console.warn('[parse] color is empty — check the Ink Color field.');
  if (out.cost == null) console.warn('[parse] cost is missing.');
  if (unmappedSymbols.size) console.warn('[parse] unmapped symbol(s) dropped — add to SYMBOLS:', [...unmappedSymbols]);
}

/** Note synthesized reminders and non-schema fields that were dropped off the card. */
function noteSynthesizedAndDropped(out, synthesizedReminder, illustrator, releaseDate) {
  if (synthesizedReminder) console.info('[parse] synthesized the standard Singer reminder for this song — verify it matches the printed card.');
  if (!illustrator && !releaseDate) return;
  console.info('[parse] dropped non-schema fields:', {illustrator, releaseDate});
  if (releaseDate) console.info(`[parse] → put release date in sets["${out.setCode || '<code>'}"].releaseDate as YYYY-MM-DD (got "${releaseDate}").`);
}

// =====================================================================
// Orchestrator.
// =====================================================================

function parseLorcanaCard(doc = document, opts = {}) {
  const container = doc.querySelector('.card-details');
  if (!container) throw new Error('Card details container not found');

  const unmappedSymbols = new Set();
  const fields = groupFields(scrapeLeaves(container, unmappedSymbols));

  const first = (k) => (fields[k] && fields[k][0]) || '';
  const all = (k) => fields[k] || [];
  const num = (k) => { const v = first(k).replace(/[^0-9]/g, ''); return v === '' ? null : Number(v); };

  // --- type + subtypes ("Action • Song" -> type "Action", subtype "Song") ---
  const typeParts = first('Card Type').split('•').map((s) => s.trim()).filter(Boolean);
  const type = typeParts[0] || '';
  const classifications = all('Classifications').flatMap((s) => s.split('•')).map((s) => s.trim()).filter(Boolean);
  const subtypes = [...new Set([...typeParts.slice(1), ...classifications])];

  // --- ink color (single "Amber" or dual "Amethyst-Sapphire") ---
  const inks = all('Ink Color')
    .flatMap((s) => s.split(/[•/,]| and /i))
    .map((s) => s.trim())
    .filter(Boolean);
  const color = inks.join('-');

  const cost = num('Ink Cost');

  // --- card text: keep ALL blocks (incl. reminder parentheticals) for layout fidelity ---
  const rawTextBlocks = all('Card Text').map((s) => s.trim()).filter(Boolean);
  const textBlocks = rawTextBlocks.slice();
  const synthesizedReminder = maybeSynthesizeSongReminder(textBlocks, {
    type, subtypes, cost, rawTextBlocks, keywordsAbilities: first('Keywords + Abilities'),
  });

  const fullText = textBlocks.join('\n');
  const fullTextSections = textBlocks.slice();
  const abilities = extractAbilities(textBlocks);

  // --- identity ---
  const ident = resolveIdentity({
    name: first('Name'),
    version: first('Version'),
    subtitle: first('Subtitle'),
    setName: first('Set'),
    cardId: first('Card ID'),
    opts,
  });

  const out = {
    id: ident.id,
    name: ident.name,
    version: ident.version,
    fullName: ident.version ? `${ident.name} - ${ident.version}` : ident.name,
    cost,
    color,
    inkwell: /yes/i.test(first('Inkwell')),
    type,
    subtypes,
    fullText,
    fullTextSections,
    abilities,
    strength: num('Strength'),
    willpower: num('Willpower'),
    lore: num('Lore'),
    setCode: ident.setCode,
    number: ident.number,
    rarity: cleanRarity(first('Rarity')),
    franchise: first('Franchise') || '',
    images: (() => { const img = scrapeImage(doc); return {thumbnail: img, full: img}; })(),
  };
  if (type !== 'Character') { delete out.strength; delete out.willpower; delete out.lore; }

  pruneEmpty(out);

  warnMissingFields(out, ident.setName, unmappedSymbols);
  noteSynthesizedAndDropped(out, synthesizedReminder, first('Illustrator'), first('Release Date'));
  return out;
}

/** Return a unique NUMBER for this card's `id` (a setCode-prefixed composite). */
function deriveCardId(ctx) {
  // `id` is the pipeline's primary key — loader dedup, getCardById, the synergy
  // filename (data/synergies/{id}.json), and the preview-image rewrite
  // (/card-images-preview/{id}.avif) — so it must be a unique Number that also
  // never collides with the canonical sequential ids already in allCards.json
  // (a collision makes the loader silently drop the preview card, since allCards
  // wins on id). Canonical ids are low (set 12 tops out near 2919), so a
  // setCode-prefixed composite stays safely above them.
  const {setCode, number, name} = ctx;
  const set = Number(setCode);
  // Number('') === 0 and Number.isFinite(0) is true, so reject set <= 0 too —
  // otherwise an unresolved setCode would mint a low id that collides with
  // canonical allCards ids (and the loader would silently drop the preview card).
  if (!Number.isInteger(set) || set <= 0) {
    throw new Error('deriveCardId: numeric setCode required — pass opts.setCode (e.g. "13").');
  }
  // Numbered card: setNum * 1000 + collector number (e.g. Set 13 #1 -> 13001).
  if (Number.isInteger(number) && number > 0) {
    return set * 1000 + number;
  }
  // Promo with no collector number: stable hash of the name into a reserved
  // 900-999 band so it can't collide with numbered cards (1-899) in the set.
  let h = 0;
  for (const ch of String(name)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return set * 1000 + 900 + (h % 100);
}

// --- Auto-run when pasted into a browser devtools console on a card page ----------
// Parses the card, logs it, copies the JSON to the clipboard, and downloads it as
// {id}-{slug}.json. Skipped under Node (no document) so the module stays testable.
if (typeof document !== 'undefined' && document.querySelector && document.querySelector('.card-details')) {
  try {
    const card = parseLorcanaCard(document);
    console.log(card);
    const json = JSON.stringify(card, null, 2);
    const slug = String(card.fullName || card.id)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const blob = new Blob([json], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${card.id}-${slug}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    try {
      if (typeof copy === 'function') copy(json); // devtools-only clipboard helper
    } catch (e) {
      /* `copy` only exists in the devtools console */
    }
  } catch (e) {
    console.error(
      '[parse]',
      e.message,
      '\nIf the set is unknown, add it to SET_NAME_TO_CODE or call parseLorcanaCard(document, {setCode: "13"}).',
    );
  }
}

if (typeof module !== 'undefined' && module.exports) module.exports = {parseLorcanaCard};
```
