import type {Meta, StoryObj} from '@storybook/react-vite';
import {MemoryRouter} from 'react-router-dom';
import {COLORS, FONTS, FONT_SIZES, SPACING} from '../../shared/constants';
import busiestWeek from './notes/2026-09-28.json';
import {ReleaseNotesWeekSection} from './ReleaseNotesWeekSection';
import type {ReleaseNotesWeek} from './types';

const SEPTEMBER_28_2026 = busiestWeek as ReleaseNotesWeek;

const meta: Meta<typeof ReleaseNotesWeekSection> = {
  title: 'Features/ReleaseNotes/ReleaseNotesWeekSection',
  component: ReleaseNotesWeekSection,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <MemoryRouter>
        {/* The prose column LegalPage gives the week on the release notes page. */}
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

/** The busiest real week so far: every section, four highlights and a link. */
export const WeekOfSeptember28: Story = {
  args: {notes: SEPTEMBER_28_2026},
};

/** A quiet week: only Fixed, no highlight, no link and no behind-the-scenes line. */
export const OneSection: Story = {
  args: {
    notes: {
      schemaVersion: 2,
      week: '2026-11-02',
      title: 'November 2 to 8, 2026',
      summary: 'A quieter week of fixes.',
      sections: {
        fixed: [
          {title: 'Card search', body: 'Search finds cards by their franchise again.'},
          {title: 'Card images', body: 'Two Set 14 cards gained their missing art.'},
        ],
      },
    },
  },
};
