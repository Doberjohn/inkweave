import type {Meta, StoryObj} from '@storybook/react-vite';
import {COLORS, SPACING} from '../../../shared/constants';
import type {Binder} from './binderRules';
import {STORY_AMBER, STORY_BINDER_ENTRIES, STORY_BINDER_POOL} from './binderStoryData';
import {DraftCount, DraftPreview, RulesFields} from './BinderWindowParts';
import {startOf, useBinderDraft} from './useBinderDraft';

interface PartProps {
  /** The binder the draft starts from, or null for a new one. */
  binder: Binder | null;
  part: 'preview' | 'rules' | 'count';
  isMobile: boolean;
}

/** One part of the window over a draft of the story pool, at the column's width it has there. */
function WindowPart({binder, part, isMobile}: PartProps) {
  const draft = useBinderDraft({start: startOf(binder), pool: STORY_BINDER_POOL, entries: STORY_BINDER_ENTRIES});
  const width = part === 'rules' && !isMobile ? 480 : 300;
  return (
    <div style={{width, padding: SPACING.xl, background: COLORS.background}}>
      {part === 'preview' && <DraftPreview draft={draft} />}
      {part === 'rules' && <RulesFields draft={draft} isMobile={isMobile} locked={false} />}
      {part === 'count' && <DraftCount draft={draft} />}
    </div>
  );
}

/**
 * The New binder window's parts: the preview column (cover, count, chips, first page),
 * the rules column (Name, Sets, the filter panel's sections, Name has) and the count alone, as
 * the phone's summary row shows it. `BinderWindow`'s stories show them together.
 */
const meta: Meta<typeof WindowPart> = {
  title: 'Collection/Binders/BinderWindowParts',
  component: WindowPart,
  tags: ['autodocs'],
  args: {binder: STORY_AMBER, part: 'preview', isMobile: false},
};

export default meta;
type Story = StoryObj<typeof meta>;

/** Amber's preview: its Legendary on the cover, its count and bar, its chip, its first page with the cards you lack in grey. */
export const Preview: Story = {};

/** A new binder's preview: every card, "Name it" on the plate, no chips. */
export const PreviewEveryCard: Story = {args: {binder: null}};

/** Rules that hold no card: 0 cards and the line that says so. */
export const PreviewNoCards: Story = {
  args: {binder: {...STORY_AMBER, name: 'Sapphire', rules: 'ink=Sapphire'}},
};

/** The rules column on a computer: the filter panel's own sections between Sets and Name has. */
export const Rules: Story = {args: {part: 'rules'}};

/** The rules on a phone, in the phone's filter sections. */
export const RulesPhone: Story = {args: {part: 'rules', isMobile: true}, globals: {viewport: {value: 'mobile1'}}};

/** The count alone, as the phone's summary row shows it. */
export const Count: Story = {args: {part: 'count'}};
