import {describe, it, expect} from 'vitest';
import {formatReport} from './report.mjs';

const run = (cards, extra = {}) => ({
  runId: '20260926-081500',
  season: {setCode: '14', setName: 'Hyperia City', setTotal: 204},
  site: {total: 81, pages: [30, 30, 21]},
  cards,
  ...extra,
});

const ernesto = {
  status: 'written',
  id: 14118,
  number: 118,
  title: 'Ernesto de la Cruz - Idol of Millions',
  card: {name: 'Ernesto de la Cruz', version: 'Idol of Millions', inks: ['Ruby'], rarity: 'Common'},
  notes: [],
};

describe('formatReport', () => {
  it('opens with the set, the site total and how many cards were already in Inkweave', () => {
    const text = formatReport(
      run({a: ernesto, b: {status: 'known', number: 21}}),
      {cards: {}},
      '2026-09-26',
    );
    expect(text).toContain('Set 14 (Hyperia City)');
    expect(text).toContain('Site: 81 cards on 3 pages');
    expect(text).toContain('1 already in Inkweave');
  });

  it('lists written cards by id, and never lists cards that were already in Inkweave', () => {
    const text = formatReport(
      run({a: ernesto, b: {status: 'known', number: 21, title: 'Miguel Rivera'}}),
      {cards: {}},
      '2026-09-26',
    );
    expect(text).toMatch(
      /WRITTEN \(1\)\n\s+14118\s+Ernesto de la Cruz - Idol of Millions\s+Ruby\s+Common/,
    );
    expect(text).not.toContain('Miguel Rivera');
  });

  it('lists a written card under the name it was written with, without accents', () => {
    const chloe = {
      status: 'written',
      id: 14009,
      number: 9,
      title: 'Test Chloé - Café Owner',
      card: {name: 'Test Chloé', version: 'Café Owner', inks: ['Amber'], rarity: 'Rare'},
    };
    expect(formatReport(run({chloe}), {cards: {}}, '2026-09-26')).toMatch(
      /14009\s+Test Chloe - Cafe Owner\s+Amber\s+Rare/,
    );
  });

  it('calls a card ready to write before the write step has run', () => {
    const ready = {...ernesto, status: 'ready', id: undefined};
    expect(formatReport(run({a: ready}), {cards: {}}, '2026-09-26')).toContain(
      'READY TO WRITE (1)',
    );
  });

  it('shows how long each deferred card has been waiting, from its first-seen date', () => {
    const cards = {
      'on-the-open-road': {
        status: 'deferred',
        reason: 'scan-not-english',
        detail: 'JA',
        number: 27,
        title: 'On the Open Road',
      },
    };
    const section = {cards: {'on-the-open-road': {status: 'deferred', firstSeen: '2026-09-23'}}};
    expect(formatReport(run(cards), section, '2026-09-26')).toMatch(
      /#27\s+On the Open Road\s+waiting 3 days\s+scan not in English \(JA\)/,
    );
  });

  it('keeps a long deferral reason clear of the waiting time', () => {
    const cards = {
      mulan: {
        status: 'deferred',
        reason: 'site-record-incomplete',
        detail: 'classifications missing',
        number: 127,
        title: 'Mulan - Martial Arts Master',
      },
    };
    expect(formatReport(run(cards), {cards: {}}, '2026-09-26')).toMatch(
      /waiting 0 days\s+site record incomplete: classifications missing$/m,
    );
  });

  it('says how many readers a card still waiting on them has been given', () => {
    const cards = {
      lionheart: {
        status: 'reading',
        number: 147,
        title: 'Lionheart - Cleaning Up the City',
        jobs: ['a1', 'b2', 'c3'],
      },
    };
    const text = formatReport(run(cards), {cards: {}}, '2026-09-26');
    expect(text).toContain('3 reader job(s) assigned');
    expect(text).not.toContain('undefined');
  });

  it('shows both sides of a field conflict', () => {
    const cards = {
      x: {
        status: 'conflict',
        number: 159,
        title: 'Bellwether - Super Capable',
        conflicts: [
          {
            field: 'version',
            site: 'Super Capable',
            readers: ['Exceptionally Capable', 'Exceptionally Capable', 'Exceptionally Capable'],
          },
        ],
      },
    };
    expect(formatReport(run(cards), {cards: {}}, '2026-09-26')).toContain(
      'version: site "Super Capable"; readers "Exceptionally Capable", "Exceptionally Capable", "Exceptionally Capable"',
    );
  });

  it('says "unreadable" for a reader that could not read the disputed field', () => {
    const cards = {
      x: {
        status: 'conflict',
        number: 150,
        title: 'Test Inventor - Gadget Tinkerer',
        conflicts: [
          {
            field: 'subtypes',
            site: ['Storyborn', 'Hero', 'Inventor', 'Ally'],
            readers: [null, null, null],
          },
        ],
      },
    };
    expect(formatReport(run(cards), {cards: {}}, '2026-09-26')).toContain(
      'subtypes: site "Storyborn / Hero / Inventor / Ally"; readers unreadable, unreadable, unreadable',
    );
  });

  it('explains a card that needs a reserved-band id', () => {
    const cards = {
      numberless: {
        status: 'conflict',
        reason: 'needs-reserved-band',
        title: 'Test Captain - Harbor Watch',
      },
    };
    expect(formatReport(run(cards), {cards: {}}, '2026-09-26')).toMatch(
      /--\s+Test Captain - Harbor Watch\s+no readable collector number/,
    );
  });

  it('names slugs retired from waiting because they left the site', () => {
    expect(
      formatReport(run({}, {retired: ['bellwether-super-capable']}), {cards: {}}, '2026-09-26'),
    ).toContain('retired from waiting: bellwether-super-capable');
  });
});

describe('formatReport: the official list', () => {
  const official = (malformed = []) => ({
    official: {revealed: 103, lastModified: '2026-09-24 11:04 UTC', malformed},
  });

  it('opens with how many cards the official list shows, and how fresh it is', () => {
    expect(formatReport(run({}, official()), {cards: {}}, '2026-09-26')).toContain(
      'Official list: 103 revealed in #1-204 (illumineertales.com, last modified 2026-09-24 11:04 UTC)',
    );
  });

  it('names official entries the run could not read', () => {
    expect(
      formatReport(run({}, official(['#147 Lionheart'])), {cards: {}}, '2026-09-26'),
    ).toContain('Set aside as unreadable: #147 Lionheart');
  });

  it('says why a card is held back as not officially revealed', () => {
    const cards = {
      leak: {
        status: 'deferred',
        reason: 'not-officially-revealed',
        detail: 'illumineertales.com has not revealed #144',
        number: 144,
        title: 'Test Leak - Never Revealed',
      },
    };
    expect(formatReport(run(cards), {cards: {}}, '2026-09-26')).toMatch(
      /#144\s+Test Leak - Never Revealed\s+waiting 0 days\s+not officially revealed \(illumineertales\.com has not revealed #144\)/,
    );
  });

  it('shows both sites for every field they disagree on', () => {
    const cards = {
      x: {
        status: 'conflict',
        reason: 'official-mismatch',
        number: 150,
        title: 'Test Tinker - Gadget Tinkerer',
        conflicts: [
          {field: 'ink', site: ['Amber'], official: ['Sapphire']},
          {field: 'rarity', site: 'Rare', official: 'Uncommon'},
        ],
      },
    };
    expect(formatReport(run(cards), {cards: {}}, '2026-09-26')).toContain(
      'ink: site "Amber"; official "Sapphire"; rarity: site "Rare"; official "Uncommon"',
    );
  });

  it('shows the official version beside the readers when they could not settle it', () => {
    const cards = {
      fred: {
        status: 'conflict',
        reason: 'unsettled',
        number: 91,
        title: 'Fred - Great Stomper',
        conflicts: [
          {
            field: 'version',
            site: 'Great Stomper',
            official: 'Big Stomper',
            readers: ['Big Stomper', 'Great Stomper', 'Mighty Stomper'],
          },
        ],
      },
    };
    expect(formatReport(run(cards), {cards: {}}, '2026-09-26')).toContain(
      'version: site "Great Stomper"; official "Big Stomper"; readers "Big Stomper", "Great Stomper", "Mighty Stomper"',
    );
  });

  it('says why an official promo needs a reserved-band id', () => {
    const cards = {
      tramp: {
        status: 'conflict',
        reason: 'needs-reserved-band',
        detail: 'official promo RPH 2, no set number yet',
        title: 'Tramp - Quick on His Feet',
      },
    };
    expect(formatReport(run(cards), {cards: {}}, '2026-09-26')).toMatch(
      /--\s+Tramp - Quick on His Feet\s+official promo RPH 2, no set number yet: needs a reserved-band id/,
    );
  });

  it('lists Inkweave cards to check, and official cards lorcanaplayer does not have yet', () => {
    const extra = {
      audit: [{id: 14144, name: 'Test Leak - Never Revealed', problem: 'not officially revealed'}],
      waiting: [
        {
          number: 12,
          name: 'P.J. Pete - Devoted Fan',
          revealedOn: '2026-09-23',
          revealedBy: 'Se Liga!',
        },
      ],
    };
    const text = formatReport(run({}, extra), {cards: {}}, '2026-09-26');
    expect(text).toMatch(
      /ON INKWEAVE, CHECK AGAINST THE OFFICIAL LIST \(1\)\n\s+14144\s+Test Leak - Never Revealed\s+not officially revealed/,
    );
    expect(text).toMatch(
      /OFFICIAL, NOT ON LORCANAPLAYER YET \(1\)\n\s+#12\s+P\.J\. Pete - Devoted Fan\s+revealed 2026-09-23 \(Se Liga!\)/,
    );
  });

  it('leaves both lists out when they are empty', () => {
    const text = formatReport(run({}, {audit: [], waiting: []}), {cards: {}}, '2026-09-26');
    expect(text).not.toContain('CHECK AGAINST THE OFFICIAL LIST');
    expect(text).not.toContain('NOT ON LORCANAPLAYER YET');
  });
});
