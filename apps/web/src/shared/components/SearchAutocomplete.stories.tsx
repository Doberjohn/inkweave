import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {SearchAutocomplete} from './SearchAutocomplete';

// Complete LorcanaCard shape, Core-era sets (#512: no cast, no pre-Core mocks).
const card = (id: string, name: string, setCode: string): LorcanaCard => ({
  id,
  name: name.split(' - ')[0],
  version: name.split(' - ')[1],
  fullName: name,
  ink: 'Sapphire',
  cost: 3,
  inkwell: true,
  type: 'Character',
  setCode,
});

const suggestions = [
  card('1', 'Elsa - Snow Queen', '9'),
  card('2', 'Elsa - Spirit of Winter', '10'),
  card('3', 'Elsa - Ice Surfer', '11'),
  card('4', 'Belle - Strange but Special', '9'),
];

const noopListboxProps = {
  role: 'listbox' as const,
  id: 'search-listbox',
  'aria-label': 'Search suggestions',
};

const noopGetOptionProps = (index: number) => ({
  id: `option-${index}`,
  role: 'option' as const,
  'aria-selected': false as boolean,
  onMouseDown: fn(),
  onMouseEnter: fn(),
});

const meta: Meta<typeof SearchAutocomplete> = {
  title: 'Shared/SearchAutocomplete',
  component: SearchAutocomplete,
  parameters: {layout: 'centered'},
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{width: 420, position: 'relative'}}>
        <Story />
      </div>
    ),
  ],
  args: {
    suggestions,
    isOpen: true,
    highlightedIndex: -1,
    query: 'els',
    listboxProps: noopListboxProps,
    getOptionProps: noopGetOptionProps,
  },
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithHighlight: Story = {
  args: {highlightedIndex: 1},
};

export const SingleResult: Story = {
  args: {
    suggestions: [card('1', 'Elsa - Snow Queen', '5')],
    query: 'Snow',
  },
};

export const Closed: Story = {
  args: {isOpen: false},
};
