import type {Meta, StoryObj} from '@storybook/react-vite';
import {MemoryRouter} from 'react-router-dom';
import {COLORS, FONTS, FONT_SIZES, SPACING} from '../../shared/constants';
import september from './notes/2026-09.json';
import {ReleaseNotesMonthSection} from './ReleaseNotesMonthSection';
import type {ReleaseNotesMonth} from './types';

const SEPTEMBER_2026 = september as ReleaseNotesMonth;

const meta: Meta<typeof ReleaseNotesMonthSection> = {
  title: 'Features/ReleaseNotes/ReleaseNotesMonthSection',
  component: ReleaseNotesMonthSection,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <MemoryRouter>
        {/* The prose column LegalPage gives the month on the release notes page. */}
        <div
          style={{
            maxWidth: 720,
            padding: SPACING.lg,
            color: COLORS.descriptionText,
            fontFamily: FONTS.body,
            fontSize: FONT_SIZES.xl,
            lineHeight: 1.7,
          }}>
          <Story />
        </div>
      </MemoryRouter>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof meta>;

/** The first real month, every section and four highlights. */
export const September2026: Story = {
  args: {notes: SEPTEMBER_2026},
};

/** A quiet month: only Fixed, one highlight, no link and no behind-the-scenes line. */
export const OneSection: Story = {
  args: {
    notes: {
      schemaVersion: 1,
      month: '2026-11',
      title: 'November 2026',
      summary: 'A quieter month of fixes.',
      sections: {
        fixed: [
          {
            title: 'Card search',
            body: 'Search finds cards by their franchise again.',
            highlight: true,
          },
          {title: 'Card images', body: 'Two Set 14 cards gained their missing art.'},
        ],
      },
    },
  },
};
