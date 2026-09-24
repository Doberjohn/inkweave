/**
 * Code that runs inside a lorcanaplayer.com tab in the owner's Chrome.
 *
 * Only that browser gets past Cloudflare (curl and automated browsers get 403 on pages and
 * images alike), so the skill injects `install` once per run and then calls the small
 * functions it leaves on `window.__revealSync`.
 *
 * The page code stays deliberately dumb: fetch, flatten, download. All interpretation lives
 * in the tested Node modules (extract-card.mjs, gates.mjs), and the parser's strict label
 * check fails loudly if this flattener ever produces the wrong shape.
 *
 * Results leave the page as a downloaded JSON file, never as the tool's return value: the
 * browser tool truncates results after roughly a kilobyte. Card images travel inside that
 * file as base64, so each batch is one download.
 */

export const BROWSER_API_VERSION = 'reveal-sync/1';

/* global window, document, location, fetch, DOMParser, NodeFilter, Node, Blob, URL, FileReader */
function install(version) {
  const GLYPH = {Ink: '⬡', Lore: '◊', Exert: '⟳', Strength: '¤', Willpower: '⛉'};
  const BLOCK = new Set([
    'DIV',
    'P',
    'LI',
    'TR',
    'TD',
    'TH',
    'H1',
    'H2',
    'H3',
    'H4',
    'SECTION',
    'BR',
    'TABLE',
  ]);
  const PAUSE_MS = 250;
  const MAX_INDEX_PAGES = 40;
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const get = (url) => fetch(url, {credentials: 'same-origin'});
  const parse = async (response) =>
    new DOMParser().parseFromString(await response.text(), 'text/html');
  const slugOf = (href) => new URL(href, location.origin).pathname.replace(/^\/card\/|\/$/g, '');

  // What one node adds to the flattened text: its text, its glyph, or a line break.
  function textOf(node) {
    if (node.nodeType === Node.TEXT_NODE) return node.nodeValue;
    if (node.tagName === 'IMG') {
      const glyph = GLYPH[node.getAttribute('alt')];
      return glyph ? ` ${glyph} ` : '';
    }
    return BLOCK.has(node.tagName) ? '\n' : '';
  }

  // One line per block element; glyph images become their card characters.
  function flatten(root) {
    const walker = root.ownerDocument.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
    );
    let out = '';
    while (walker.nextNode()) out += textOf(walker.currentNode);
    return out
      .split('\n')
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .filter(Boolean);
  }

  // The card scan: the first raster upload in the article, at full size.
  function cardImageUrl(article) {
    const src = [...article.querySelectorAll('img')]
      .map((img) => img.getAttribute('src') || '')
      .find((s) => /\/wp-content\/uploads\/.+\.(jpe?g|png|webp)$/i.test(s));
    return src ? new URL(src.replace(/-\d+x\d+(\.\w+)$/, '$1'), location.origin).href : null;
  }

  function save(name, data) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(data)], {type: 'application/json'}));
    const link = Object.assign(document.createElement('a'), {href: url, download: name});
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  const toBase64 = (blob) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

  // One page of the set's faceted index as card slugs, or null once past the last page.
  // Scoped to #primary: the sidebar's "latest cards" links repeat on every page and are
  // not results.
  async function indexPage(n, setSlug, rarities) {
    const path = n === 1 ? '/cards/' : `/cards/page/${n}/`;
    const response = await get(`${path}?cardset=${setSlug}&rarity=${encodeURIComponent(rarities)}`);
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`index page ${n}: HTTP ${response.status}`);
    const scope = (await parse(response)).querySelector('#primary');
    if (!scope) throw new Error(`index page ${n} has no #primary: the markup changed`);
    const links = [...scope.querySelectorAll('a[href*="/card/"]')];
    return [...new Set(links.map((a) => slugOf(a.getAttribute('href'))))];
  }

  // Walk the index until a page 404s.
  async function discover({setSlug, rarities, runId}) {
    const slugs = new Set();
    const pages = [];
    for (let n = 1; ; n++) {
      if (n > MAX_INDEX_PAGES)
        throw new Error(`index never returned 404 in ${MAX_INDEX_PAGES} pages`);
      const found = await indexPage(n, setSlug, rarities);
      if (!found) break;
      pages.push(found.length);
      found.forEach((slug) => slugs.add(slug));
      await sleep(PAUSE_MS);
    }
    const file = `reveal-sync-${runId}-index.json`;
    save(file, {version, runId, setSlug, pages, slugs: [...slugs]});
    return {file, pages, total: slugs.size};
  }

  // The collector number from the "Card ID" row, or NaN when the page has none.
  const collectorNumber = (lines) =>
    Number(((lines[lines.indexOf('Card ID') + 1] || '').match(/^(\d+)\s*\//) || [])[1]);

  async function fetchImage(url) {
    const image = await get(url);
    if (!image.ok) return {error: image.status};
    return {type: image.headers.get('content-type'), base64: await toBase64(await image.blob())};
  }

  async function fetchCard(slug, knownNumbers) {
    const response = await get(`/card/${slug}/`);
    if (!response.ok) return {slug, status: response.status};
    const article = (await parse(response)).querySelector('article');
    if (!article) return {slug, status: response.status, error: 'page has no <article>'};
    const lines = flatten(article);
    const imageUrl = cardImageUrl(article);
    const card = {
      slug,
      status: response.status,
      lines,
      imageFile: imageUrl && imageUrl.split('/').pop(),
    };
    if (imageUrl && !knownNumbers.includes(collectorNumber(lines))) {
      await sleep(PAUSE_MS);
      card.image = await fetchImage(imageUrl);
    }
    return card;
  }

  // "slug:403" for a failed page, "slug:image-403" for a failed scan, or null.
  function failureOf(card) {
    if (card.status !== 200 || card.error) return `${card.slug}:${card.status}`;
    if (card.image && card.image.error) return `${card.slug}:image-${card.image.error}`;
    return null;
  }

  // Fetch each card page (and its scan, unless the card is already in Inkweave) and save
  // the batch as one file.
  async function fetchCards(slugs, {runId, batch, knownNumbers = []}) {
    const cards = [];
    for (const slug of slugs) {
      cards.push(await fetchCard(slug, knownNumbers));
      await sleep(PAUSE_MS);
    }
    const file = `reveal-sync-${runId}-cards-${batch}.json`;
    save(file, {version, runId, batch, cards});
    return {
      file,
      fetched: cards.length,
      images: cards.filter((c) => c.image && c.image.base64).length,
      failed: cards.map(failureOf).filter(Boolean),
    };
  }

  window.__revealSync = {version, discover, fetchCards};
  return version;
}

/** The JavaScript to pass to the browser tool once per run; it returns the API version. */
export function installSnippet() {
  return `(${install.toString()})(${JSON.stringify(BROWSER_API_VERSION)})`;
}
