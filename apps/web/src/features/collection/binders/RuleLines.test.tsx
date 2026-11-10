import {afterEach, describe, expect, it} from 'vitest';
import {cleanup, fireEvent, render, screen, within} from '@testing-library/react';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {FilterContent} from 'inkweave-ui/lorcana/FilterContent';
import {FILTER_VOCABULARY} from '../../cards/filterOptions';
import type {Binder} from './binderRules';
import {RuleLines} from './RuleLines';
import {startOf, useBinderDraft, type BinderDraft} from './useBinderDraft';

/** A card named by its id: a 1-cost Amber Common in Set 12 unless told otherwise. */
const cardOf = (facts: Partial<LorcanaCard> & Pick<LorcanaCard, 'id'>) =>
  ({name: facts.id, fullName: facts.id, cost: 1, ink: 'Amber', inkwell: true, type: 'Character', rarity: 'Common', setCode: '12', setNumber: 1, ...facts}) as LorcanaCard;

const POOL = [
  cardOf({id: 'amber-hero', classifications: ['Storyborn', 'Hero'], keywords: ['Ward']}),
  cardOf({id: 'amber-legend', rarity: 'Legendary', classifications: ['Villain'], keywords: ['Evasive']}),
  cardOf({id: 'steel-epic', ink: 'Steel', rarity: 'Epic', setNumber: 210}),
  cardOf({id: 'steel-promo', ink: 'Steel', rarity: 'Special', setCode: 'P1', setNumber: 5}),
];

/**
 * Browse's filter panel over the same draft. Save as a binder writes a binder's rules from that
 * panel and Edit rules opens them in the lines, so the two must write the same rules.
 */
function PanelRules({draft}: {draft: BinderDraft}) {
  const {filters, options} = draft;
  return (
    <FilterContent
      inkFilters={filters.draftInks}
      typeFilters={filters.draftTypes}
      costFilters={filters.draftCosts}
      filters={filters.draftFilters}
      uniqueKeywords={options.keywords}
      uniqueClassifications={options.classifications}
      uniqueRarities={options.rarities}
      sets={[]}
      onToggleInk={filters.toggleInk}
      onToggleType={filters.toggleType}
      onToggleCost={filters.toggleCost}
      onFiltersChange={filters.updateFilters}
      vocabulary={FILTER_VOCABULARY}
      variant="panel"
      showSetFilter={false}
      showArtPresets
    />
  );
}

/** The lines (or the panel) over a draft of the pool, and the rules the draft writes. */
function Harness({binder = null, panel = false, isMobile = false}: {binder?: Binder | null; panel?: boolean; isMobile?: boolean}) {
  const draft = useBinderDraft({start: startOf(binder), pool: POOL, entries: {}});
  return (
    <>
      {panel ? <PanelRules draft={draft} /> : <RuleLines draft={draft} isMobile={isMobile} />}
      <output data-testid="rules">{draft.input.rules}</output>
    </>
  );
}

const rules = () => screen.getByTestId('rules').textContent;
const press = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', {name}));
const line = (name: string) => screen.getByRole('group', {name});
const namesIn = (group: HTMLElement) => within(group).getAllByRole('button').map((b) => b.getAttribute('aria-label') ?? b.textContent);

/** Opens a line's dropdown and picks an option. */
function pickFrom(label: string, option: string) {
  fireEvent.click(within(line(label)).getByRole('button', {name: /^Any/}));
  fireEvent.click(screen.getByRole('option', {name: option}));
}

/** The same picks on either: two inks with Dual-ink cards, Uninkable, a cost, a rarity and a type. */
function pickShared() {
  press('Filter by Amber');
  press('Filter by Steel');
  press('Dual-ink cards');
  press('Uninkable');
  press('Cost 3');
  press('Legendary');
  press('Character');
}

describe('RuleLines', () => {
  afterEach(cleanup);

  it("offers on each line what the filter panel's section offered", () => {
    render(<Harness />);
    expect(within(line('Ink')).getAllByRole('button')).toHaveLength(6);
    expect(namesIn(line('Inkwell'))).toEqual(['Inkable', 'Uninkable']);
    expect(within(line('Ink cost')).getAllByRole('button')).toHaveLength(9);
    expect(namesIn(line('Rarity'))).toEqual(['Common', 'Legendary', 'Epic', 'Promo', 'Standard cards', 'Alt art cards']);
    expect(namesIn(line('Type'))).toEqual(['Character', 'Action', 'Song', 'Item', 'Location']);
    fireEvent.click(within(line('Classification')).getByRole('button', {name: 'Any classification'}));
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Hero', 'Storyborn', 'Villain']);
    expect(screen.getByRole('textbox', {name: 'Name has'})).toBeInTheDocument();
  });

  it('writes the same rules from the same picks as the filter panel', () => {
    render(<Harness panel />);
    // The panel folds these sections.
    for (const section of ['Type', 'Keyword', 'Classification']) press(section);
    pickShared();
    press('Hero');
    press('Ward');
    const fromPanel = rules();
    cleanup();
    render(<Harness />);
    pickShared();
    pickFrom('Classification', 'Hero');
    pickFrom('Keyword', 'Ward');
    expect(rules()).toBe(fromPanel);
    expect(fromPanel).toBe(
      'ink=Amber%2CSteel&type=Character&cost=3&keyword=Ward&classification=Hero&rarity=Legendary&inkwell=uninkable&inkmatch=dual',
    );
  });

  it('offers Dual-ink cards only for one ink or a pair, and writes it only there', () => {
    render(<Harness />);
    expect(screen.queryByRole('button', {name: 'Dual-ink cards'})).not.toBeInTheDocument();
    press('Filter by Amber');
    press('Dual-ink cards');
    expect(rules()).toBe('ink=Amber&inkmatch=dual');
    press('Filter by Steel');
    press('Filter by Ruby');
    expect(screen.queryByRole('button', {name: 'Dual-ink cards'})).not.toBeInTheDocument();
    // Three inks hold every card of each, so the binder keeps no dual-ink rule it doesn't apply.
    expect(rules()).toBe('ink=Amber%2CSteel%2CRuby');
  });

  it('picks a kind of rarity with an art preset, and lights it while the picks are exactly its own', () => {
    render(<Harness />);
    press('Alt art cards');
    expect(rules()).toBe('rarity=Epic%2CSpecial');
    expect(screen.getByRole('button', {name: 'Alt art cards'})).toHaveAttribute('aria-pressed', 'true');
    press('Common');
    expect(screen.getByRole('button', {name: 'Alt art cards'})).toHaveAttribute('aria-pressed', 'false');
  });

  it('shows a binder opened in Edit rules with its rules picked', () => {
    const binder: Binder = {
      id: 'b1',
      name: 'Amber villains',
      scope: 'all',
      rules: 'q=Ursula&ink=Amber&cost=3&classification=Villain&rarity=Legendary&inkwell=inkable',
      pages: 4,
      cover: null,
      place: 0,
    };
    render(<Harness binder={binder} />);
    for (const name of ['Filter by Amber', 'Cost 3', 'Legendary', 'Inkable']) {
      expect(screen.getByRole('button', {name})).toHaveAttribute('aria-pressed', 'true');
    }
    expect(within(line('Classification')).getByRole('button', {name: /^Villain/})).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: 'Name has'})).toHaveValue('Ursula');
    expect(rules()).toBe(binder.rules);
  });

  it('stacks each name over its choices on a phone, and sets them side by side on a computer', () => {
    render(<Harness isMobile />);
    expect(line('Ink')).toHaveStyle({flexDirection: 'column'});
    cleanup();
    render(<Harness />);
    expect(line('Ink')).toHaveStyle({display: 'grid'});
  });
});
