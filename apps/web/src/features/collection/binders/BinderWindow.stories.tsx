import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn, userEvent, within} from 'storybook/test';
import {BinderWindow} from './BinderWindow';
import {STORY_AMBER, STORY_BINDER_ENTRIES, STORY_BINDER_POOL} from './binderStoryData';

/**
 * The New binder window (#1075), and Edit rules': the binder's name, its Sets and its rules on
 * the left, and on the right what they make, its cover, count, chips and first page, following
 * every pick. Create binder stays off until it has a name and a card. A sheet on a phone, with
 * Cancel and Create in its header. The window's saves reach the server, so these stories never
 * press Create; its unit tests hold the saving and failure states.
 */
const meta: Meta<typeof BinderWindow> = {
  title: 'Collection/Binders/BinderWindow',
  component: BinderWindow,
  tags: ['autodocs'],
  args: {
    isOpen: true,
    binder: null,
    pool: STORY_BINDER_POOL,
    entries: STORY_BINDER_ENTRIES,
    readerId: 'story-reader',
    isMobile: false,
    onSaved: fn(),
    onClose: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

/** The window lives in a portal, outside the story's canvas. */
const page = () => within(document.body);

/** Names the binder and picks an ink. */
async function pick(name: string, ink: string) {
  await userEvent.type(page().getByRole('textbox', {name: 'Name'}), name);
  await userEvent.click(page().getByRole('button', {name: `Filter by ${ink}`}));
}

/** Opened from New binder: no name, every set, no rule. Create binder waits for a name. */
export const New: Story = {};

/** Amber picked and named: its count, its cover's art, its chip and its first page. */
export const FilledIn: Story = {play: () => pick('Amber', 'Amber')};

/** Rules that hold no card: 0 cards, the line that says so, and Create binder off. */
export const NoCards: Story = {play: () => pick('Sapphire', 'Sapphire')};

/** Edit rules on Amber: its name and rules filled in, and Save changes off until something changes. */
export const EditRules: Story = {args: {binder: STORY_AMBER}};

/** A phone's sheet: Cancel, the title and Create in its header, the cover and count above the rules. */
export const Phone: Story = {args: {isMobile: true}, globals: {viewport: {value: 'mobile1'}}};

/** A phone with Amber picked and named. */
export const PhoneFilledIn: Story = {...Phone, play: () => pick('Amber', 'Amber')};

/** A phone's Edit rules. */
export const PhoneEditRules: Story = {...Phone, args: {isMobile: true, binder: STORY_AMBER}};
