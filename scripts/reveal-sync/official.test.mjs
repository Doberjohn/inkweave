import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {afterEach, describe, it, expect} from 'vitest';
import {
  OFFICIAL_ORIGIN,
  OfficialListError,
  applyOfficialRuling,
  applyOfficialRulings,
  downloadOfficialImage,
  fetchOfficialList,
  fileSlug,
  leakAudit,
  nameSlug,
  officialImageUrls,
  officialSummary,
  officialVerdict,
  parseOfficialList,
  waitingForSite,
} from './official.mjs';
import {RulingError} from './adjudicate.mjs';
import {parseCardLines} from './extract-card.mjs';
import {
  LIONHEART,
  ON_THE_OPEN_ROAD,
  TEST_CAPTAIN,
  TEST_INVENTOR,
  page,
} from './__fixtures__/cards.mjs';
import {OFFICIAL_JSON, SEASON14} from './__fixtures__/official.mjs';

const official = () => parseOfficialList(structuredClone(OFFICIAL_JSON), SEASON14);
const entry = (n) => official().cards.find((c) => c.set_number === n);
const site = (card, patch = {}) =>
  parseCardLines(page(card, patch), {slug: card.slug, imageFile: card.imageFile});
const scan = (file) => `${OFFICIAL_ORIGIN}/card-images/${file}`;
/** A lorcanaplayer record for an official card, built from the Lionheart page with its fields swapped. */
const lpCard = (number, name, version, ink, rarity) =>
  site(LIONHEART, {
    'Card ID': `${number}/204`,
    Name: name,
    Version: version,
    'Ink Color': ink,
    Rarity: rarity,
  });

describe('fileSlug and nameSlug', () => {
  it('builds image slugs exactly as the site does, so an accent becomes a break', () => {
    expect(fileSlug('Héctor Rivera')).toBe('he-ctor-rivera');
    expect(fileSlug('Mamá Coco')).toBe('mama-coco');
    expect(fileSlug('Thomas O’Malley')).toBe('thomas-omalley');
    expect(fileSlug("That's Not Like Max, Is It?")).toBe('thats-not-like-max-is-it');
  });

  it("builds the accent-free slug lorcanaplayer's pages use", () => {
    expect(nameSlug('Héctor Rivera - Worldwide Sensation')).toBe(
      'hector-rivera-worldwide-sensation',
    );
    expect(nameSlug("Molly Cunningham - Don't Forget to Share")).toBe(
      'molly-cunningham-dont-forget-to-share',
    );
  });
});

describe('parseOfficialList', () => {
  it('keeps only revealed entries, although unrevealed slots carry an ink', () => {
    const list = official();
    expect(list.cards.map((c) => c.set_number)).toEqual([
      14, 44, 60, 73, 91, 106, 118, 147, 150, 152, 182, 213,
    ]);
    expect(list.promos).toHaveLength(2);
    expect(list.setKey).toBe('set-14-hyperia-city');
  });

  it('counts a card as official whatever its rarity field says', () => {
    expect(entry(182).rarity).toBe('');
    expect(entry(60).rarity).toBe('PROMO');
  });

  it("throws, naming the keys it found, when the season's set is missing", () => {
    const nextSeason = {...SEASON14, setNumber: 15, setSlug: 'next-set'};
    expect(() => parseOfficialList(OFFICIAL_JSON, nextSeason)).toThrow(OfficialListError);
    expect(() => parseOfficialList(OFFICIAL_JSON, nextSeason)).toThrow(
      /set-15-next-set.*set-14-hyperia-city, promos/,
    );
  });

  it('throws when nothing in the set is revealed', () => {
    const empty = {'set-14-hyperia-city': [OFFICIAL_JSON['set-14-hyperia-city'][0]], promos: []};
    expect(() => parseOfficialList(empty, SEASON14)).toThrow(/no readable revealed card/);
  });

  it('says how many entries it set aside when none it could read is left', () => {
    const json = structuredClone(OFFICIAL_JSON);
    for (const slot of json['set-14-hyperia-city']) slot.card_type = slot.card_type.toLowerCase();
    expect(() => parseOfficialList(json, SEASON14)).toThrow(/12 set aside as unreadable/);
  });
});

describe('an official entry the code cannot read', () => {
  // The site's entry for #147 loses its card type: it is revealed, but unreadable.
  const withUnreadable147 = () => {
    const json = structuredClone(OFFICIAL_JSON);
    json['set-14-hyperia-city'].find((c) => c.set_number === 147).card_type = '';
    return parseOfficialList(json, SEASON14);
  };

  it('is set aside and named, rather than failing the run', () => {
    const list = withUnreadable147();
    expect(list.cards.map((c) => c.set_number)).not.toContain(147);
    expect(officialSummary(list, 204).malformed).toEqual(['#147 Lionheart']);
  });

  it('holds its card back as unreadable, never as a leak', () => {
    expect(officialVerdict(site(LIONHEART), withUnreadable147())).toEqual({
      status: 'deferred',
      reason: 'official-entry-unreadable',
      detail: "illumineertales.com's entry #147 Lionheart could not be read",
    });
  });

  it('is reported in the audit as one to check by hand, never as not officially revealed', () => {
    const present = [{id: 14147, number: 147, name: 'Lionheart - Cleaning Up the City'}];
    expect(leakAudit(present, withUnreadable147())).toEqual([
      {
        id: 14147,
        name: 'Lionheart - Cleaning Up the City',
        problem: 'official entry unreadable: check it by hand',
      },
    ]);
  });
});

describe('fetchOfficialList', () => {
  const respond = (body, init) => async () => new Response(body, init);

  it('reads the list and when the site last changed it', async () => {
    const lastModified = 'Thu, 24 Sep 2026 11:04:43 GMT';
    const fetchImpl = async (url) => {
      expect(url).toBe(`${OFFICIAL_ORIGIN}/cards.json`);
      return new Response(JSON.stringify(OFFICIAL_JSON), {
        headers: {'last-modified': lastModified},
      });
    };
    const list = await fetchOfficialList(SEASON14, {fetchImpl});
    expect(list.lastModified).toBe(lastModified);
    expect(list.cards).toHaveLength(12);
  });

  it('fails closed on a network error, a bad status, or a body that is not JSON', async () => {
    // Node's fetch says only "fetch failed"; the reason is in `cause`, and must reach the owner.
    const offline = async () => {
      throw new TypeError('fetch failed', {cause: {code: 'ENOTFOUND'}});
    };
    await expect(fetchOfficialList(SEASON14, {fetchImpl: offline})).rejects.toThrow(
      /fetch failed \(ENOTFOUND\)/,
    );
    await expect(
      fetchOfficialList(SEASON14, {fetchImpl: respond('busy', {status: 503})}),
    ).rejects.toThrow(/HTTP 503/);
    await expect(
      fetchOfficialList(SEASON14, {fetchImpl: respond('<html>', {status: 200})}),
    ).rejects.toThrow(OfficialListError);
  });
});

describe('officialSummary', () => {
  it('counts the revealed cards inside the main set', () => {
    const list = {...official(), lastModified: 'Thu, 24 Sep 2026 11:04:43 GMT'};
    expect(officialSummary(list, 204)).toMatchObject({
      revealed: 11,
      lastModified: '2026-09-24 11:04 UTC',
    });
  });
});

describe('officialImageUrls', () => {
  it('builds the scan URL the site itself uses', () => {
    expect(officialImageUrls(entry(147), 'lionheart-cleaning-up-the-city')).toEqual([
      scan('147-lionheart-cleaning-up-the-city-1024.webp?v=app'),
    ]);
  });

  it('keeps accents the way the site does, and adds no ?v= without an image version', () => {
    expect(officialImageUrls(entry(106))).toEqual([
      scan('106-he-ctor-rivera-worldwide-sensation-1024.webp'),
    ]);
  });

  it("leaves an Action's version out of the filename", () => {
    expect(officialImageUrls(entry(60))).toEqual([
      scan('060-everyone-knows-juanita-1024.webp?v=app'),
    ]);
  });

  it('numbers a promo by its promo set', () => {
    expect(officialImageUrls(official().promos[0])).toEqual([
      scan('rph-1-everyone-knows-juanita-1024.webp?v=press'),
    ]);
  });

  it("falls back to lorcanaplayer's name when the site renamed the card but not its file", () => {
    expect(officialImageUrls(entry(73), 'molly-cunningham-dont-forget-to-share')).toEqual([
      scan('073-molly-cunningham-remember-to-share-1024.webp?v=app'),
      scan('073-molly-cunningham-dont-forget-to-share-1024.webp?v=app'),
    ]);
  });
});

describe('officialVerdict', () => {
  it('passes a card the list shows under its collector number', () => {
    const verdict = officialVerdict(site(TEST_INVENTOR), official());
    expect(verdict).toMatchObject({status: 'pass', adoptedNumber: null});
    expect(verdict.entry.set_number).toBe(150);
  });

  it('holds back a card whose number is not revealed, whatever name it carries', () => {
    expect(officialVerdict(site(TEST_INVENTOR, {'Card ID': '144/204'}), official())).toEqual({
      status: 'deferred',
      reason: 'not-officially-revealed',
      detail: 'illumineertales.com has not revealed #144',
    });
  });

  it('holds back a numberless card the list does not show', () => {
    expect(officialVerdict(site(TEST_CAPTAIN), official())).toMatchObject({
      status: 'deferred',
      reason: 'not-officially-revealed',
      detail: 'illumineertales.com has no card by this name',
    });
  });

  it('finds a numberless card by name and adopts its official number', () => {
    const juanita = site(ON_THE_OPEN_ROAD, {
      Name: 'Everyone Knows Juanita',
      'Card ID': '',
      'Ink Color': 'Amethyst',
      Rarity: 'Common',
    });
    expect(officialVerdict(juanita, official())).toMatchObject({status: 'pass', adoptedNumber: 60});
  });

  it('takes a blank official rarity as no opinion', () => {
    const toulouse = lpCard(182, 'Toulouse', 'Rough and Tumble', 'Steel', 'Rare');
    expect(officialVerdict(toulouse, official())).toMatchObject({status: 'pass'});
  });

  it('sends a card that is only an official promo to the reserved band', () => {
    const tramp = site(TEST_CAPTAIN, {
      Name: 'Tramp',
      Version: 'Quick on His Feet',
      'Ink Color': 'Ruby',
    });
    expect(officialVerdict(tramp, official())).toEqual({
      status: 'conflict',
      reason: 'needs-reserved-band',
      detail: 'official promo RPH 2, no set number yet',
    });
  });

  it('defers an official reveal that was not in English', () => {
    const nick = lpCard(14, 'Nick Wilde', 'Toy Drive Volunteer', 'Amber', 'Super Rare');
    expect(officialVerdict(nick, official())).toEqual({
      status: 'deferred',
      reason: 'scan-not-english',
      detail: 'official reveal is not in English',
    });
  });

  it('lets a version difference through, for the readers to settle', () => {
    const fred = lpCard(91, 'Fred', 'Great Stomper', 'Emerald', 'Common');
    const verdict = officialVerdict(fred, official());
    expect(verdict.status).toBe('pass');
    expect(verdict.entry.subtitle).toBe('Big Stomper');
  });

  it('lists every field the two sites disagree on', () => {
    const disputed = site(TEST_INVENTOR, {
      Name: 'Test Tinker',
      'Ink Color': 'Amber',
      Rarity: 'Rare',
    });
    expect(officialVerdict(disputed, official())).toMatchObject({
      status: 'conflict',
      reason: 'official-mismatch',
      conflicts: [
        {field: 'name', site: 'Test Tinker', official: 'Test Inventor'},
        {field: 'ink', site: ['Amber'], official: ['Sapphire']},
        {field: 'rarity', site: 'Rare', official: 'Uncommon'},
      ],
    });
  });

  it('compares names without regard to accents or apostrophes', () => {
    const hector = lpCard(106, 'Hector Rivera', 'Worldwide Sensation', 'Ruby', 'Legendary');
    const tom = lpCard(152, "Thomas O'Malley", 'Savvy Vagabond', 'Sapphire', 'Super Rare');
    expect(officialVerdict(hector, official()).status).toBe('pass');
    expect(officialVerdict(tom, official()).status).toBe('pass');
  });

  it('skips the fields the owner has already ruled on', () => {
    const rare = site(TEST_INVENTOR, {Rarity: 'Rare'});
    expect(officialVerdict(rare, official(), {accepted: ['rarity']}).status).toBe('pass');
  });
});

describe('applyOfficialRuling', () => {
  const record = {name: 'Test Tinker', inks: ['Amber'], type: 'Item', rarity: 'Rare'};

  it("copies the official value in lorcanaplayer's shape", () => {
    const rule = (field, from = entry(150)) => applyOfficialRuling(record, from, field, 'official');
    expect(rule('name').site.name).toBe('Test Inventor');
    expect(rule('ink').site.inks).toEqual(['Sapphire']);
    expect(rule('type').site.type).toBe('Character');
    expect(rule('rarity').site.rarity).toBe('Uncommon');
    expect(rule('rarity', entry(152)).site.rarity).toBe('Super Rare');
    expect(rule('rarity').accepted).toEqual(['rarity']);
  });

  it('keeps lorcanaplayer\'s value on a ruling of "site"', () => {
    expect(applyOfficialRuling(record, entry(150), 'rarity', 'site')).toEqual({
      site: record,
      accepted: ['rarity'],
    });
  });

  it("takes the owner's own value, parsed", () => {
    expect(applyOfficialRuling(record, entry(150), 'rarity', 'super rare').site.rarity).toBe(
      'Super Rare',
    );
    expect(applyOfficialRuling(record, entry(150), 'ink', 'Amber / Steel').site.inks).toEqual([
      'Amber',
      'Steel',
    ]);
    expect(applyOfficialRuling(record, entry(150), 'name', '  Test Tinker ').site.name).toBe(
      'Test Tinker',
    );
  });

  it('refuses a value that does not parse, and a field the sites are not compared on', () => {
    const mythic = () => applyOfficialRuling(record, entry(150), 'rarity', 'Mythic');
    expect(mythic).toThrow(/cannot read the ruling "Mythic" as a rarity/);
    expect(mythic).toThrow(RulingError);
    expect(() => applyOfficialRuling(record, entry(150), 'cost', '3')).toThrow(
      /name, ink, type, rarity/,
    );
  });

  it('says so when the official list has no value to rule with', () => {
    // Toulouse's official rarity is still blank.
    expect(() => applyOfficialRuling(record, entry(182), 'rarity', 'official')).toThrow(
      /the official list has no rarity for this card/,
    );
  });

  it('clears every disputed field so the card passes the official check', () => {
    const disputed = site(TEST_INVENTOR, {Name: 'Test Tinker', Rarity: 'Rare'});
    const ruled = applyOfficialRulings(disputed, official(), {name: 'official', rarity: 'site'});
    expect(ruled.site).toMatchObject({name: 'Test Inventor', rarity: 'Rare'});
    expect(officialVerdict(ruled.site, official(), {accepted: ruled.accepted}).status).toBe('pass');
  });
});

describe('downloadOfficialImage', () => {
  const dirs = [];
  const tempDir = () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'official-scan-'));
    dirs.push(dir);
    return dir;
  };
  afterEach(() => {
    for (const dir of dirs.splice(0)) fs.rmSync(dir, {recursive: true, force: true});
  });
  const webp = () =>
    new Response(new Uint8Array([82, 73, 70, 70]), {headers: {'content-type': 'image/webp'}});
  const html = (status) => new Response('<html>', {status, headers: {'content-type': 'text/html'}});

  it('writes the scan from the first URL that serves one, and says when that was the fallback', async () => {
    const dir = tempDir();
    const asked = [];
    const fetchImpl = async (url) => {
      asked.push(url);
      return url.includes('dont-forget') ? webp() : html(404);
    };
    const molly = entry(73);
    const urls = officialImageUrls(molly, 'molly-cunningham-dont-forget-to-share');
    expect(
      await downloadOfficialImage(molly, 'molly-cunningham-dont-forget-to-share', dir, {fetchImpl}),
    ).toEqual({url: urls[1], fallback: true});
    expect(asked).toEqual(urls);
    expect([...fs.readFileSync(path.join(dir, 'image.webp'))]).toEqual([82, 73, 70, 70]);
  });

  it('reports no fallback when the URL the site builds serves the scan', async () => {
    const result = await downloadOfficialImage(
      entry(147),
      'lionheart-cleaning-up-the-city',
      tempDir(),
      {
        fetchImpl: async () => webp(),
      },
    );
    expect(result).toEqual({url: officialImageUrls(entry(147))[0], fallback: false});
  });

  it('moves on to the next URL after a network error', async () => {
    let calls = 0;
    const fetchImpl = async () => {
      calls += 1;
      if (calls === 1) throw new Error('socket hang up');
      return webp();
    };
    expect(
      await downloadOfficialImage(entry(73), 'molly-cunningham-dont-forget-to-share', tempDir(), {
        fetchImpl,
      }),
    ).toMatchObject({fallback: true});
  });

  it('treats a download that breaks off mid-body as a failed URL, never a crash', async () => {
    const brokenBody = async () => ({
      ok: true,
      status: 200,
      headers: new Headers({'content-type': 'image/webp'}),
      arrayBuffer: async () => {
        throw new TypeError('terminated', {cause: {code: 'ECONNRESET'}});
      },
    });
    const result = await downloadOfficialImage(entry(147), null, tempDir(), {
      fetchImpl: brokenBody,
    });
    expect(result).toMatchObject({status: 'deferred', reason: 'official-image-missing'});
    expect(result.detail).toContain('terminated (ECONNRESET)');
  });

  it('never takes an HTML page for a scan, and names every URL it tried', async () => {
    const dir = tempDir();
    const result = await downloadOfficialImage(
      entry(73),
      'molly-cunningham-dont-forget-to-share',
      dir,
      {
        fetchImpl: async () => html(200),
      },
    );
    expect(result).toMatchObject({status: 'deferred', reason: 'official-image-missing'});
    expect(result.detail).toContain('remember-to-share');
    expect(result.detail).toContain('dont-forget-to-share');
    expect(fs.existsSync(path.join(dir, 'image.webp'))).toBe(false);
  });
});

describe('leakAudit', () => {
  it('flags Inkweave cards the list does not show, or shows under another name', () => {
    const present = [
      {id: 14091, number: 91, name: 'Fred - Great Stomper'},
      {id: 14106, number: 106, name: 'Hector Rivera - Worldwide Sensation'},
      {id: 14144, number: 144, name: 'Test Leak - Never Revealed'},
      {id: 14147, number: 147, name: 'Lionheart - Cleaning Up the City'},
      {id: 14901, number: null, name: 'Toulouse - Rough and Tumble'},
      {id: 14902, number: null, name: 'Tramp - Quick on His Feet'},
      {id: 14903, number: null, name: 'Test Captain - Harbor Watch'},
    ];
    expect(leakAudit(present, official())).toEqual([
      {
        id: 14091,
        name: 'Fred - Great Stomper',
        problem: 'name differs: official "Fred - Big Stomper"',
      },
      {id: 14144, name: 'Test Leak - Never Revealed', problem: 'not officially revealed'},
      {id: 14901, name: 'Toulouse - Rough and Tumble', problem: 'official as #182: renumber it'},
      {id: 14902, name: 'Tramp - Quick on His Feet', problem: 'official promo RPH 2'},
      {id: 14903, name: 'Test Captain - Harbor Watch', problem: 'not officially revealed'},
    ]);
  });
});

describe('waitingForSite', () => {
  it('lists official main-set cards the site has not got yet', () => {
    const coverage = {
      slugs: [
        'lionheart-cleaning-up-the-city',
        'toulouse-rough-and-tumble',
        'hector-rivera-worldwide-sensation',
      ],
      numbers: [118, 150],
    };
    expect(waitingForSite(official(), coverage, 204).map((c) => c.set_number)).toEqual([
      14, 44, 60, 73, 91, 152,
    ]);
  });
});
