import {describe, it, expect, vi} from 'vitest';
import {fireEvent, render, screen, within} from '@testing-library/react';
import type {Ink} from 'inkweave-synergy-engine';
import {FilterContent, type FilterContentProps} from '../FilterContent';
import type {FilterPicks, FilterVocabulary} from '../../lib/filterModel';
import {TEST_FILTER_VOCABULARY} from '../../test-utils/filterVocabulary';

/** The panel, which shows every section, with one vocabulary member swapped. */
function renderPanel(vocabulary: Partial<FilterVocabulary>, overrides: Partial<FilterContentProps> = {}) {
  const onFiltersChange = vi.fn();
  render(
    <FilterContent
      inkFilters={[]}
      typeFilters={[]}
      costFilters={[]}
      filters={{}}
      uniqueKeywords={[]}
      uniqueClassifications={[]}
      uniqueRarities={[]}
      sets={[]}
      onToggleInk={vi.fn()}
      onToggleType={vi.fn()}
      onToggleCost={vi.fn()}
      onFiltersChange={onFiltersChange}
      variant="panel"
      vocabulary={{...TEST_FILTER_VOCABULARY, ...vocabulary}}
      {...overrides}
    />,
  );
  return onFiltersChange;
}

const buttonNames = (group: string) =>
  within(screen.getByRole('group', {name: group}))
    .getAllByRole('button')
    .map((button) => button.getAttribute('aria-label') ?? button.textContent);

describe('FilterContent vocabulary', () => {
  it("names each rarity in the vocabulary's words", () => {
    renderPanel({rarityLabel: (rarity) => `${rarity} tier`}, {uniqueRarities: ['Common', 'Mythic']});
    const group = screen.getByRole('group', {name: 'Rarity filters'});
    expect(within(group).getByRole('button', {name: 'Common tier'})).toHaveAttribute('title', 'Common tier');
    expect(within(group).getByRole('button', {name: 'Mythic tier'})).toHaveTextContent('Mythic tier');
  });

  it("draws each set's logo from the vocabulary, and a set without one by its name", () => {
    renderPanel(
      {setLogo: (code) => (code === '9' ? '/logos/nine.webp' : undefined)},
      {sets: [{code: '9', name: 'Fabled', number: 9}, {code: '10', name: 'Whispers in the Well', number: 10}]},
    );
    fireEvent.click(screen.getByRole('button', {name: 'Set'}));
    const group = screen.getByRole('group', {name: 'Set filters'});
    expect(within(group).getByRole('button', {name: 'Fabled'}).querySelector('img')).toHaveAttribute(
      'src',
      '/logos/nine.webp',
    );
    expect(within(group).getByRole('button', {name: 'Whispers in the Well'})).toHaveTextContent('Whispers in the Well');
  });

  it("offers the vocabulary's art presets, each picking its own rarities", () => {
    const onFiltersChange = renderPanel(
      {artPresets: () => [{value: 'shiny', label: 'Shiny cards', title: 'Pick the shiny ones', rarities: ['Rare']}]},
      {uniqueRarities: ['Common', 'Rare'], showArtPresets: true},
    );
    const preset = screen.getByRole('button', {name: 'Shiny cards'});
    expect(preset).toHaveAttribute('title', 'Pick the shiny ones');
    fireEvent.click(preset);
    expect(onFiltersChange).toHaveBeenCalledWith({rarities: ['Rare']});
  });

  it('offers Dual-ink cards for the ink counts the vocabulary allows', () => {
    const offersDualInk = (inkCount: number) => inkCount === 3;
    renderPanel({offersDualInk}, {inkFilters: ['Amber', 'Steel', 'Ruby'] as Ink[]});
    expect(screen.getByRole('button', {name: 'Dual-ink cards'})).toBeInTheDocument();
  });

  it("shows the vocabulary's buttons when the page narrows none", () => {
    renderPanel({allButtons: {inks: ['Ruby'], costs: [4], types: ['Item'], inkwell: ['uninkable']}});
    expect(buttonNames('Ink color filters')).toEqual(['Filter by Ruby']);
    expect(buttonNames('Ink cost filters')).toEqual(['Cost 4']);
    expect(buttonNames('Inkwell filters')).toEqual(['Uninkable']);
    fireEvent.click(screen.getByRole('button', {name: /^Type/}));
    expect(buttonNames('Card type filters')).toEqual(['Item']);
  });

  it("keeps the fields it doesn't know when it changes a pick", () => {
    // The app's own filtering fields, such as Browse's rarityMatch, ride along with the picks.
    const filters = {keywords: ['Evasive'], rarityMatch: 'printings'} as FilterPicks;
    const onFiltersChange = renderPanel({}, {filters, uniqueKeywords: ['Evasive', 'Ward']});
    fireEvent.click(screen.getByRole('button', {name: /^Keyword/}));
    fireEvent.click(screen.getByRole('button', {name: 'Ward'}));
    expect(onFiltersChange).toHaveBeenCalledWith({keywords: ['Evasive', 'Ward'], rarityMatch: 'printings'});
  });
});
