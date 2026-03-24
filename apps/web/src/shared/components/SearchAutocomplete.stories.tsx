import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {CardPreviewProvider} from '../../features/cards/components/CardPreviewProvider';
import {SearchAutocomplete} from './SearchAutocomplete';

const card = (id: string, name: string, setCode: string): LorcanaCard =>
  ({
    id,
    name: name.split(' - ')[0],
    fullName: name,
    ink: 'Sapphire',
    cost: 3,
    type: 'Character',
    setCode,
  }) as LorcanaCard;

const suggestions = [
  card('1', 'Elsa - Snow Queen', '5'),
  card('2', 'Elsa - Spirit of Winter', '6'),
  card('3', 'Elsa - Ice Surfer', '7'),
  card('4', 'Belle - Strange but Special', '5'),
];

const noopListboxProps = {
  role: 'listbox' as const,
  id: 'search-listbox',
  'aria-label': 'Search suggestions',
};

const noopGetOptionProps = (index: number) => ({
  role: 'option' as const,
  id: `option-${index}`,
  'aria-selected': false as const,
  onClick: fn(),
});

const meta: Meta<typeof SearchAutocomplete> = {
  title: 'Shared/SearchAutocomplete',
  component: SearchAutocomplete,
  parameters: {layout: 'centered'},
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <CardPreviewProvider>
        <div style={{width: 420, position: 'relative'}}>
          <Story />
        </div>
      </CardPreviewProvider>
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
