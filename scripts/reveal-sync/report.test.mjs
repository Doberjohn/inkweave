import {describe, it, expect} from 'vitest';
import {formatReport} from './report.mjs';

const run = (cards, extra = {}) => ({
  runId: '20260926-081500',
  season: {setCode: '14', setName: 'Hyperia City'},
  site: {total: 81, pages: [30, 30, 21]},
  cards,
  ...extra,
});

const ernesto = {
  status: 'written',
  id: 14118,
  number: 118,
  title: 'Ernesto de la Cruz - Idol of Millions',
  card: {inks: ['Ruby'], rarity: 'Common'},
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
        detail: 'abilities listed as Unknown',
        number: 127,
        title: 'Mulan - Martial Arts Master',
      },
    };
    expect(formatReport(run(cards), {cards: {}}, '2026-09-26')).toMatch(
      /waiting 0 days\s+site record incomplete: abilities listed as Unknown$/m,
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
        number: 144,
        title: 'Honey Lemon - Ingenious Researcher',
        conflicts: [
          {
            field: 'subtypes',
            site: ['Dreamborn', 'Hero', 'Inventor', 'Super'],
            readers: [null, null, null],
          },
        ],
      },
    };
    expect(formatReport(run(cards), {cards: {}}, '2026-09-26')).toContain(
      'subtypes: site "Dreamborn / Hero / Inventor / Super"; readers unreadable, unreadable, unreadable',
    );
  });

  it('explains a card that needs a reserved-band id', () => {
    const cards = {
      hook: {
        status: 'conflict',
        reason: 'needs-reserved-band',
        title: 'Captain Hook - Concerned Captain',
      },
    };
    expect(formatReport(run(cards), {cards: {}}, '2026-09-26')).toMatch(
      /--\s+Captain Hook - Concerned Captain\s+no readable collector number/,
    );
  });

  it('names slugs retired from waiting because they left the site', () => {
    expect(
      formatReport(run({}, {retired: ['bellwether-super-capable']}), {cards: {}}, '2026-09-26'),
    ).toContain('retired from waiting: bellwether-super-capable');
  });
});
