import {describe, it, expect, vi} from 'vitest';
import {fireEvent, render, screen, within} from '@testing-library/react';
import {FilterContent} from '../FilterContent';
import type {Ink} from '../../../features/cards';
import type {CardFilterOptions} from '../../../features/cards';
import type {CardTypeFilter} from '../../constants';

function defaultProps(overrides = {}) {
  return {
    inkFilters: [] as Ink[],
    typeFilters: [] as CardTypeFilter[],
    costFilters: [] as number[],
    filters: {} as CardFilterOptions,
    uniqueKeywords: [],
    uniqueClassifications: [],
    uniqueRarities: [] as string[],
    sets: [],
    onToggleInk: vi.fn(),
    onToggleType: vi.fn(),
    onToggleCost: vi.fn(),
    onFiltersChange: vi.fn(),
    variant: 'desktop' as const,
    ...overrides,
  };
}

describe('FilterContent cost section', () => {
  it('hides the Ink Cost section on desktop when cost icons are inline', () => {
    render(<FilterContent {...defaultProps({variant: 'desktop', showInlineCost: true})} />);
    expect(screen.queryByText('Ink Cost')).not.toBeInTheDocument();
  });

  it('shows the Ink Cost section on desktop when cost icons are tucked away', () => {
    render(<FilterContent {...defaultProps({variant: 'desktop', showInlineCost: false})} />);
    expect(screen.getByText('Ink Cost')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Cost 3'})).toBeInTheDocument();
  });

  it('always shows the Ink Cost section on mobile', () => {
    render(<FilterContent {...defaultProps({variant: 'mobile', showInlineCost: true})} />);
    expect(screen.getByText('Ink Cost')).toBeInTheDocument();
  });
});

describe('FilterContent button options', () => {
  it('offers only the values in buttonOptions', () => {
    const buttonOptions = {
      inks: ['Ruby'] as Ink[],
      costs: [2, 9],
      types: ['Song'] as CardTypeFilter[],
      inkwell: ['inkable'] as const,
    };
    render(<FilterContent {...defaultProps({variant: 'mobile', buttonOptions})} />);

    // Icon buttons are named by aria-label, text buttons by their text.
    const buttonNames = (group: string) =>
      within(screen.getByRole('group', {name: group}))
        .getAllByRole('button')
        .map((button) => button.getAttribute('aria-label') ?? button.textContent);
    expect(buttonNames('Ink color filters')).toEqual(['Filter by Ruby']);
    expect(buttonNames('Ink cost filters')).toEqual(['Cost 2', 'Cost 9+']);
    expect(buttonNames('Card type filters')).toEqual(['Song']);
    expect(buttonNames('Inkwell filters')).toEqual(['Inkable']);
  });

  it('leaves out a chip section with nothing to offer', () => {
    render(<FilterContent {...defaultProps({variant: 'mobile', uniqueClassifications: ['Hero']})} />);

    expect(screen.queryByRole('group', {name: 'Keyword filters'})).not.toBeInTheDocument();
    expect(screen.getByRole('group', {name: 'Classification filters'})).toBeInTheDocument();
  });
});

describe('FilterContent inkwell section', () => {
  it('leaves Inkwell to a desktop toolbar that carries it inline', () => {
    render(<FilterContent {...defaultProps({variant: 'desktop'})} />);
    expect(screen.queryByText('Inkwell')).not.toBeInTheDocument();
  });

  it('shows Inkwell on desktop when the toolbar has no inline toggles', () => {
    render(<FilterContent {...defaultProps({variant: 'desktop', showInlineInkwell: false})} />);
    expect(screen.getByRole('button', {name: /Uninkable/})).toBeInTheDocument();
  });
});

describe('FilterContent chip pickers', () => {
  it('adds a second keyword to the picks rather than replacing the first', () => {
    const onFiltersChange = vi.fn();
    render(
      <FilterContent
        {...defaultProps({
          variant: 'panel',
          uniqueKeywords: ['Evasive', 'Ward'],
          filters: {keywords: ['Evasive']},
          onFiltersChange,
        })}
      />,
    );
    // Panel sections other than Ink, Inkwell and Ink Cost start folded.
    fireEvent.click(screen.getByRole('button', {name: /^Keyword/}));
    fireEvent.click(screen.getByRole('button', {name: 'Ward'}));
    expect(onFiltersChange).toHaveBeenCalledWith({keywords: ['Evasive', 'Ward']});
  });

  it('offers the given rarities, open in the panel, picking any of them', () => {
    const onFiltersChange = vi.fn();
    render(
      <FilterContent
        {...defaultProps({variant: 'panel', uniqueRarities: ['Common', 'Rare'], filters: {rarities: ['Rare']}, onFiltersChange})}
      />,
    );
    // Open by default in the panel: no header click needed.
    const group = screen.getByRole('group', {name: 'Rarity filters'});
    fireEvent.click(within(group).getByRole('button', {name: 'Common'}));
    expect(onFiltersChange).toHaveBeenCalledWith({rarities: ['Rare', 'Common']});
  });

  it('shows each rarity by its symbol alone, and one without a symbol by its name', () => {
    // Every rarity Browse or collection mode offers, so one claimed to have a
    // symbol that RaritySymbol cannot draw shows up as a blank chip here.
    // Special (promos) stands in for a rarity without one.
    const symbolled = ['Common', 'Uncommon', 'Rare', 'Super Rare', 'Legendary', 'Epic', 'Enchanted', 'Iconic'];
    render(<FilterContent {...defaultProps({variant: 'panel', uniqueRarities: [...symbolled, 'Special']})} />);
    const group = screen.getByRole('group', {name: 'Rarity filters'});
    for (const rarity of symbolled) {
      const chip = within(group).getByRole('button', {name: rarity});
      expect(chip.querySelector('img')).not.toBeNull();
      expect(chip.textContent).toBe('');
    }
    expect(within(group).getByRole('button', {name: 'Special'})).toHaveTextContent('Special');
  });

  describe('rarity lines', () => {
    const lineBreaks = () =>
      [...screen.getByRole('group', {name: 'Rarity filters'}).children].filter((el) => el.tagName === 'SPAN');

    it('puts Legendary on the second line, with the special printings', () => {
      const rarities = ['Common', 'Uncommon', 'Rare', 'Super Rare', 'Legendary', 'Epic', 'Enchanted', 'Iconic'];
      render(<FilterContent {...defaultProps({variant: 'panel', uniqueRarities: rarities})} />);
      // One line break, right before Legendary: four symbols to a line.
      expect(lineBreaks()).toHaveLength(1);
      expect(lineBreaks()[0].nextElementSibling).toBe(screen.getByRole('button', {name: 'Legendary'}));
    });

    it('keeps five rarities without printings on one line', () => {
      const rarities = ['Common', 'Uncommon', 'Rare', 'Super Rare', 'Legendary'];
      render(<FilterContent {...defaultProps({variant: 'panel', uniqueRarities: rarities})} />);
      expect(lineBreaks()).toHaveLength(0);
    });
  });

  it('lists the set logos newest first, and adds a second set to the picks', () => {
    const onFiltersChange = vi.fn();
    const sets = [
      {code: '9', name: 'Fabled', number: 9},
      {code: '11', name: 'Winterspell', number: 11},
      {code: '10', name: 'Whispers in the Well', number: 10},
    ];
    render(<FilterContent {...defaultProps({sets, filters: {setCodes: ['11']}, onFiltersChange})} />);
    const group = screen.getByRole('group', {name: 'Set filters'});
    const names = within(group)
      .getAllByRole('button')
      .map((b) => b.getAttribute('aria-label'));
    expect(names).toEqual(['Winterspell', 'Whispers in the Well', 'Fabled']);
    fireEvent.click(within(group).getByRole('button', {name: 'Fabled'}));
    expect(onFiltersChange).toHaveBeenCalledWith({setCodes: ['11', '9']});
  });

  it('clears the option when its last pick is unpicked', () => {
    const onFiltersChange = vi.fn();
    render(
      <FilterContent
        {...defaultProps({uniqueClassifications: ['Hero'], filters: {classifications: ['Hero']}, onFiltersChange})}
      />,
    );
    fireEvent.click(screen.getByRole('button', {name: 'Hero'}));
    expect(onFiltersChange).toHaveBeenCalledWith({});
  });
});

describe('FilterContent Dual-ink cards switch', () => {
  const toggle = () => screen.queryByRole('button', {name: 'Dual-ink cards'});

  it.each([
    ['no inks', []],
    ['three inks', ['Amber', 'Steel', 'Ruby']],
  ])('is not offered with %s selected', (_label, inks) => {
    render(<FilterContent {...defaultProps({variant: 'panel', inkFilters: inks as Ink[]})} />);
    expect(toggle()).toBeNull();
  });

  it.each([
    ['one ink', ['Amber']],
    ['a pair', ['Amber', 'Steel']],
  ])('is offered for %s, and switches the mode on', (_label, inks) => {
    const onFiltersChange = vi.fn();
    render(<FilterContent {...defaultProps({variant: 'panel', inkFilters: inks as Ink[], onFiltersChange})} />);
    fireEvent.click(toggle()!);
    expect(onFiltersChange).toHaveBeenCalledWith({inkMatch: 'dual'});
  });
});

describe('FilterContent art presets', () => {
  const RARITIES = ['Common', 'Uncommon', 'Rare', 'Super Rare', 'Legendary', 'Epic', 'Enchanted', 'Iconic'];
  const STANDARD = ['Common', 'Uncommon', 'Rare', 'Super Rare', 'Legendary'];
  const standard = () => screen.getByRole('button', {name: 'Standard cards'});

  it('are offered only where asked, and only with rarities of both kinds to pick', () => {
    const {rerender} = render(<FilterContent {...defaultProps({variant: 'panel', uniqueRarities: RARITIES})} />);
    expect(screen.queryByRole('group', {name: 'Card art'})).toBeNull();
    rerender(<FilterContent {...defaultProps({variant: 'panel', uniqueRarities: STANDARD, showArtPresets: true})} />);
    expect(screen.queryByRole('group', {name: 'Card art'})).toBeNull();
    rerender(<FilterContent {...defaultProps({variant: 'panel', uniqueRarities: RARITIES, showArtPresets: true})} />);
    expect(screen.getByRole('button', {name: 'Alt art cards'})).toBeInTheDocument();
  });

  it('pick a whole kind in place of the picks, and light up only while the picks are exactly it', () => {
    const onFiltersChange = vi.fn();
    const props = {variant: 'panel', uniqueRarities: RARITIES, showArtPresets: true, onFiltersChange};
    const {rerender} = render(<FilterContent {...defaultProps({...props, filters: {rarities: ['Epic']}})} />);
    fireEvent.click(standard());
    expect(onFiltersChange).toHaveBeenLastCalledWith({rarities: STANDARD});
    // Every symbol stays: the preset picks them, as picking them one by one would.
    rerender(<FilterContent {...defaultProps({...props, filters: {rarities: [...STANDARD].reverse()}})} />);
    expect(within(screen.getByRole('group', {name: 'Rarity filters'})).getAllByRole('button')).toHaveLength(8);
    expect(standard()).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(standard());
    expect(onFiltersChange).toHaveBeenLastCalledWith({});
    // Another pick besides puts it out.
    rerender(<FilterContent {...defaultProps({...props, filters: {rarities: [...STANDARD, 'Epic']}})} />);
    expect(standard()).toHaveAttribute('aria-pressed', 'false');
  });

  it('take the kit touch size in the phone drawer, with Dual-ink cards, and stay compact elsewhere', () => {
    const props = {uniqueRarities: RARITIES, showArtPresets: true, inkFilters: ['Amber'] as Ink[]};
    const {rerender} = render(<FilterContent {...defaultProps({...props, variant: 'mobile'})} />);
    expect(standard()).toHaveStyle({padding: '8px 14px'});
    expect(screen.getByRole('button', {name: 'Dual-ink cards'})).toHaveStyle({padding: '8px 14px'});
    rerender(<FilterContent {...defaultProps({...props, variant: 'panel'})} />);
    expect(standard()).toHaveStyle({padding: '2px 10px'});
  });
});

describe('FilterContent Set section', () => {
  it('leaves the Set filter out in collection mode, where the collection panel picks the set', () => {
    const sets = [{code: '9', name: 'Fabled', number: 9}];
    const {rerender} = render(<FilterContent {...defaultProps({variant: 'panel', sets})} />);
    expect(screen.getByRole('button', {name: 'Set'})).toBeInTheDocument();
    rerender(<FilterContent {...defaultProps({variant: 'panel', sets, showSetFilter: false})} />);
    expect(screen.queryByRole('button', {name: 'Set'})).toBeNull();
  });
});
