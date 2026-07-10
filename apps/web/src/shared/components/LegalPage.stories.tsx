import type {Meta, StoryObj} from '@storybook/react-vite';
import {MemoryRouter} from 'react-router-dom';
import {LegalPage, legalH2Style} from './LegalPage';

const meta: Meta<typeof LegalPage> = {
  title: 'Components/LegalPage',
  component: LegalPage,
  parameters: {layout: 'fullscreen'},
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: 'Example Legal Page',
    children: (
      <>
        <p style={{marginTop: 0}}>
          This is the shared shell used by the Privacy, Terms, Disclaimer, and About pages: a logo-home
          header, a centered reading column, and the site footer.
        </p>
        <h2 style={legalH2Style}>A section heading</h2>
        <p>Body copy uses the description-text color at the base font size with generous line height.</p>
      </>
    ),
  },
};
