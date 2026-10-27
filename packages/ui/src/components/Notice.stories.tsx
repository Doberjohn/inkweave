import type {Meta, StoryObj} from '@storybook/react-vite';
import {COLORS, FONTS, SPACING} from '../tokens/theme';
import {Notice} from './Notice';

const meta: Meta<typeof Notice> = {
  title: 'Shared/Notice',
  component: Notice,
  tags: ['autodocs'],
  parameters: {layout: 'padded'},
  decorators: [
    (Story) => (
      <div style={{color: COLORS.text, fontFamily: FONTS.body, maxWidth: 960}}>
        <Story />
      </div>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof meta>;

/** The dashed info box: loading, empty and setup states. */
export const Info: Story = {
  args: {children: 'Loading analytics...'},
};

/** The red error box for a failed load, announced as an alert. */
export const ErrorTone: Story = {
  args: {
    tone: 'error',
    children: 'Could not load vote analytics (vote-analytics.json has not been generated yet).',
  },
};

/** The info and error tones in a column, with a setup notice that names a value in code. */
export const Tones: Story = {
  args: {children: null},
  render: () => (
    <div style={{display: 'grid', gap: SPACING.xl}}>
      <Notice>Loading analytics...</Notice>
      <Notice>
        No raw votes yet. Set the{' '}
        <code style={{color: COLORS.primary}}>SUPABASE_SERVICE_ROLE_KEY</code> Actions secret, then
        re-run admin&apos;s Deploy workflow.
      </Notice>
      <Notice tone="error">
        Could not load vote analytics (vote-analytics.json has not been generated yet).
      </Notice>
    </div>
  ),
};
