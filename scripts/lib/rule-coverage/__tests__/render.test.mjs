import {describe, it, expect} from 'vitest';
import {compositionChart, partnerBuckets, scoreRange, shapeTable, tierSplit} from '../blocks.mjs';
import {doughnut, nameList, table, tallyText} from '../render.mjs';

const chartSpec = (block) => JSON.parse(block.replace(/^```chart\n|\n```$/g, ''));
const pair = (score, explanation) => ({score, explanation, ruleId: 'test'});

describe('render', () => {
  it('draws a table whose separators are as wide as their headers', () => {
    expect(table(['Role', 'Cards'], [['enabler', 3]])).toBe(
      '| Role | Cards |\n|----|-----|\n| enabler | 3 |',
    );
  });

  it('counts most common first, ties by name, and says none for nothing', () => {
    expect(tallyText(['Ruby', 'Amber', 'Ruby', 'Steel'])).toBe('Ruby 2, Amber 1, Steel 1');
    expect(tallyText([])).toBe('none');
  });

  it('lists cards by full name in the order given, and says none for no cards', () => {
    expect(nameList([{fullName: 'Dale - Ready for His Shot'}, {fullName: 'Chip - Ranger'}])).toBe(
      'Dale - Ready for His Shot, Chip - Ranger',
    );
    expect(nameList([])).toBe('none');
  });

  it('writes a chart the docs hub can parse, leaving out empty slices', () => {
    const block = doughnut('Roles (5 cards)', [
      ['Enablers', 5],
      ['Payoffs', 0],
    ]);
    expect(block).toContain('"values": [5]');
    expect(chartSpec(block).data.labels).toEqual(['Enablers (5)']);
  });

  it('titles a role composition by distinct cards, noting a card in two slices', () => {
    const [a, b, c] = [{id: 'a'}, {id: 'b'}, {id: 'c'}];
    const title = (payoffs) => {
      const slices = [
        ['Enablers', [a, b]],
        ['Payoffs', payoffs],
      ];
      return chartSpec(compositionChart(slices)).title;
    };
    expect(title([c])).toBe('Role composition (3 cards)');
    expect(title([b, c])).toBe('Role composition (3 cards; multi-role overlap)');
  });
});

describe('shapeTable', () => {
  const shapes = [
    {label: 'combo', score: 8, test: /^Combo/},
    {label: 'density', score: 5},
  ];

  it('files each pair under the first shape with its score whose test passes', () => {
    const rows = shapeTable([pair(8, 'Combo'), pair(5, 'Both'), pair(5, 'Combo too')], shapes);
    expect(rows).toContain('| combo | 1 | 8 | 33.3% |');
    expect(rows).toContain('| density | 2 | 5 | 66.7% |');
  });

  it('fails on a pair no shape takes, so a new explanation cannot go uncounted', () => {
    expect(() => shapeTable([pair(8, 'Something new')], shapes)).toThrow(
      'no pair shape for a test pair at 8: Something new',
    );
  });

  it('can leave out shapes with no pairs', () => {
    expect(shapeTable([pair(5, 'Both')], shapes, {hideEmpty: true})).not.toContain('combo');
  });
});

describe('summaries', () => {
  it('splits pairs by display tier', () => {
    expect(tierSplit([pair(3), pair(6), pair(7), pair(10)])).toBe(
      '1 Weak / 1 Moderate / 1 Strong / 1 Perfect',
    );
  });

  it('gives the score range, one score when they agree, and none for no pairs', () => {
    expect(scoreRange([pair(7), pair(5), pair(6)])).toBe('5-7');
    expect(scoreRange([pair(5), pair(5)])).toBe('5');
    expect(scoreRange([])).toBe('none');
  });

  it('buckets cards by how many partners their pages list', () => {
    const partners = new Map([
      ['a', new Set(['x'])],
      ['b', new Set(Array.from({length: 16}, (_, i) => String(i)))],
    ]);
    expect(partnerBuckets(partners, 'targets')).toEqual([
      ['1-4 targets', 1],
      ['5-9 targets', 0],
      ['10-14 targets', 0],
      ['15+ targets', 1],
    ]);
  });
});
