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
 * Usage:
 *   parseLorcanaCard(document, { setCode: '13' })          // set code is required-ish
 *   parseLorcanaCard(document, { setCode: '13', number: 1, id: 131201 })
 *
 * Convention notes baked in here (vs. the original parser):
 *   - Optional fields are OMITTED when absent, never set to null.
 *   - `setCode` is the numeric set code as a string ("13"), not the display name.
 *   - `id` / `number` are real numbers (the old code reused Card ID for both).
 *   - Non-schema fields (illustrator, releaseDate) are stripped off the card and
 *     logged instead — releaseDate belongs in sets["<code>"].releaseDate.
 *   - Song cards get the standard Singer reminder synthesized if the page omits it.
 */
function parseLorcanaCard(doc = document, opts = {}) {
  const container = doc.querySelector('.card-details');
  if (!container) throw new Error('Card details container not found');

  // Map a scraped set *name* → numeric set code. Extend per reveal season,
  // or just pass opts.setCode and ignore this.
  const SET_NAME_TO_CODE = {
    // 'The Wilds Unknown': '12',
    // 'Attack of the Vine!': '13',
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
  const unmappedSymbols = new Set();
  const nodeText = (node) => {
    let out = '';
    for (const n of node.childNodes) {
      if (n.nodeType === 3) {
        out += n.textContent;
      } else if (n.nodeType === 1) {
        if (n.tagName === 'IMG') {
          const key = (n.getAttribute('alt') || n.getAttribute('title') || '').trim().toLowerCase();
          if (SYMBOLS[key]) out += SYMBOLS[key];
          else if (key) unmappedSymbols.add(key);
        } else if (n.tagName === 'BR') {
          out += '\n';
        } else {
          out += nodeText(n);
        }
      }
    }
    return out;
  };

  // Collect ordered text blocks, then group each value under its label. An element
  // is a "block" if it has no child elements OR carries its own non-whitespace text
  // node — the latter catches ability lines like
  // "<strong>NAME</strong> effect <em>(reminder <img>)</em>" that a leaf-only walk
  // would otherwise shred down to just the bold name.
  const leaves = [];
  (function walk(el) {
    for (const c of el.children) {
      const ownText = [...c.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim() !== '');
      if (c.children.length === 0 || ownText) {
        const t = nodeText(c)
          .replace(/[^\S\n]+/g, ' ')
          .replace(/ *\n */g, '\n')
          .trim();
        if (t) leaves.push(t);
      } else {
        walk(c);
      }
    }
  })(container);

  const fields = {};
  let current = null;
  for (const item of leaves) {
    if (LABELS.has(item)) { current = item; if (!fields[current]) fields[current] = []; }
    else if (current) fields[current].push(item);
  }
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

  // Songs: synthesize the standard Singer reminder if the source page omitted it.
  // (Skip Sing Together — its reminder text differs and we can't safely guess it.)
  const isSong = type === 'Action' && subtypes.includes('Song');
  const hasReminder = textBlocks.some((b) => /sing this song for free/i.test(b));
  const isSingTogether = [...rawTextBlocks, first('Keywords + Abilities')].some((b) => /sing together/i.test(b));
  let synthesizedReminder = false;
  if (isSong && cost != null && !hasReminder && !isSingTogether) {
    textBlocks.unshift(`(A character with cost ${cost} or more can ⟳ to sing this song for free.)`);
    synthesizedReminder = true;
  }

  const fullText = textBlocks.join('\n');
  const fullTextSections = textBlocks.slice();

  // --- abilities: keep named abilities + reminder statics; drop bare effect blocks ---
  // (canonical omits an abilities entry for a plain action whose text is just an effect).
  const isUpperWord = (w) => /[A-Z]/.test(w) && !/[a-z]/.test(w);
  const inferType = (effect) => {
    if (/^(when\b|whenever\b|at the (start|end)\b|once (during|per turn)\b)/i.test(effect)) return 'triggered';
    if (/^[⟳↻]/.test(effect)) return 'activated';
    return 'static';
  };
  const splitNamed = (block) => {
    const words = block.split(/\s+/);
    let i = 0;
    while (i < words.length && isUpperWord(words[i])) i++;
    const nameRun = words.slice(0, i).join(' ');
    if (i >= 1 && i < words.length && nameRun.replace(/[^A-Za-z0-9]/g, '').length >= 2) {
      return {
        name: nameRun.replace(/[\s!?.]+$/, '').trim(),
        effect: words.slice(i).join(' ').replace(/\n/g, ' ').trim(),
      };
    }
    return null;
  };
  const abilities = textBlocks.flatMap((block) => {
    const norm = block.replace(/\n/g, ' ').trim();
    if (/^\([\s\S]*\)$/.test(block)) {
      return [{effect: norm.replace(/^\(|\)$/g, '').trim(), fullText: block, type: 'static'}];
    }
    const named = splitNamed(block);
    if (named) {
      return [{effect: named.effect, fullText: block, name: named.name, type: inferType(named.effect)}];
    }
    return []; // plain effect block → no ability entry (canonical omits these)
  });

  // --- identity fields ---
  const name = first('Name');
  const version = first('Version') || first('Subtitle') || '';
  const setName = first('Set');
  const setCode = opts.setCode ?? SET_NAME_TO_CODE[setName] ?? '';
  // Card ID is "129/207" (collector number / set total) — take the first group.
  const cardIdMatch = first('Card ID').match(/\d+/);
  const rawCardId = cardIdMatch ? Number(cardIdMatch[0]) : null;
  const number = opts.number ?? rawCardId ?? undefined;
  const id = opts.id ?? deriveCardId({ setCode, number, name, rawCardId, setName });

  // --- image (preview cards: one URL for both sizes; loader rewrites by id) ---
  const imgEl = doc.querySelector('.card-details img, article img');
  const img = imgEl ? (imgEl.currentSrc || imgEl.src) : '';

  const rarity = (first('Rarity') && !/unknown/i.test(first('Rarity'))) ? first('Rarity') : '';

  const out = {
    id,
    name,
    version,
    fullName: version ? `${name} - ${version}` : name,
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
    setCode,
    number,
    rarity,
    franchise: first('Franchise') || '',
    images: { thumbnail: img, full: img },
  };
  if (type !== 'Character') { delete out.strength; delete out.willpower; delete out.lore; }

  // Drop null/undefined/empty-string/empty-array/empty-object keys, but keep
  // valid falsy values (inkwell:false, cost:0). Canonical never emits null.
  (function prune(obj) {
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      if (v === null || v === undefined) { delete obj[k]; continue; }
      if (typeof v === 'string' && v.trim() === '') { delete obj[k]; continue; }
      if (Array.isArray(v) && v.length === 0) { delete obj[k]; continue; }
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        prune(v);
        if (Object.keys(v).length === 0) delete obj[k];
      }
    }
  })(out);

  // --- diagnostics (not part of the card; surface what needs manual attention) ---
  if (typeof out.id !== 'number' || Number.isNaN(out.id)) {
    console.warn('[parse] id is not a number — implement deriveCardId() or pass opts.id. Got:', out.id);
  }
  if (!out.setCode) console.warn('[parse] setCode unresolved — pass opts.setCode (e.g. "13") or add', JSON.stringify(setName), 'to SET_NAME_TO_CODE.');
  if (!out.color) console.warn('[parse] color is empty — check the Ink Color field.');
  if (out.cost == null) console.warn('[parse] cost is missing.');
  if (unmappedSymbols.size) {
    console.warn('[parse] unmapped symbol(s) dropped — add to SYMBOLS:', [...unmappedSymbols]);
  }
  if (synthesizedReminder) console.info('[parse] synthesized the standard Singer reminder for this song — verify it matches the printed card.');
  const illustrator = first('Illustrator');
  const releaseDate = first('Release Date');
  if (illustrator || releaseDate) {
    console.info('[parse] dropped non-schema fields:', { illustrator, releaseDate });
    if (releaseDate) console.info(`[parse] → put release date in sets["${out.setCode || '<code>'}"].releaseDate as YYYY-MM-DD (got "${releaseDate}").`);
  }

  return out;
}

/**
 * Return a unique NUMBER for this card's `id`.
 * Implemented by the maintainer — see the Learn-by-Doing note in chat.
 */
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
  if (!Number.isFinite(set)) {
    throw new Error('deriveCardId: numeric setCode required — pass opts.setCode (e.g. "13").');
  }
  // Numbered card: setNum * 1000 + collector number (e.g. Set 13 #1 -> 13001).
  if (typeof number === 'number' && !Number.isNaN(number)) {
    return set * 1000 + number;
  }
  // Promo with no collector number: stable hash of the name into a reserved
  // 900-999 band so it can't collide with numbered cards (1-899) in the set.
  let h = 0;
  for (const ch of String(name)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return set * 1000 + 900 + (h % 100);
}

// Browser console convenience: `copy(JSON.stringify(parseLorcanaCard(document, { setCode: '13' }), null, 2))`
if (typeof module !== 'undefined' && module.exports) module.exports = { parseLorcanaCard };
