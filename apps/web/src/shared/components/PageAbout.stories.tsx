import type {Meta, StoryObj} from '@storybook/react-vite';
import {MemoryRouter} from 'react-router-dom';
import {PageAbout, PageAboutLink} from './PageAbout';

const meta: Meta<typeof PageAbout> = {
  title: 'Components/PageAbout',
  component: PageAbout,
  parameters: {layout: 'padded'},
  tags: ['autodocs'],
  decorators: [(Story) => <MemoryRouter>{Story()}</MemoryRouter>],
};

export default meta;
type Story = StoryObj<typeof PageAbout>;

export const Default: Story = {
  args: {
    heading: 'About Amber cards',
    children: (
      <>
        <p>
          This page lists every Amber card in the Core format of Disney Lorcana, from Fabled onward,
          sorted by set and then by card number.
        </p>
        <p>
          Playstyles that draw many of their cards from Amber include{' '}
          <PageAboutLink to="/playstyles/healing">Healing</PageAboutLink>,{' '}
          <PageAboutLink to="/playstyles/toy">Toys</PageAboutLink> and{' '}
          <PageAboutLink to="/playstyles/monster">Monsters</PageAboutLink>.
        </p>
      </>
    ),
  },
};
