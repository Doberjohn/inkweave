import type {Meta, StoryObj} from '@storybook/react-vite';
import {MemoryRouter} from 'react-router-dom';
import {OffSeasonNotice} from './RevealsOffSeason';

const meta: Meta<typeof OffSeasonNotice> = {
  title: 'Reveals/OffSeasonNotice',
  component: OffSeasonNotice,
  decorators: [
    (Story) => (
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    ),
  ],
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof meta>;

// The state a visitor actually hits today: the set has shipped, so the copy can
// name it and say when. This is the whole reason the notice has two states
// rather than one generic message.
export const Released: Story = {
  args: {
    phase: 'released',
    dates: {
      prereleaseDate: new Date(2026, 6, 17),
      releaseDate: new Date(2026, 6, 24),
      name: 'Attack of the Vine!',
    },
  },
};

// No season configured at all, so nothing specific can be said. Reached when the
// feature flag is off rather than when a set has finished.
export const Hidden: Story = {args: {phase: 'hidden', dates: null}};

// A released set whose JSON omits its name. The copy must still say the season
// ENDED rather than falling back to "a season is coming", which would tell the
// reader the opposite of what happened.
export const ReleasedWithoutSetName: Story = {
  args: {
    phase: 'released',
    dates: {
      prereleaseDate: new Date(2026, 6, 17),
      releaseDate: new Date(2026, 6, 24),
      name: '',
    },
  },
};
