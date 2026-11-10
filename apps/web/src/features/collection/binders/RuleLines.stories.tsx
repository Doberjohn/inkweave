import type {Meta, StoryObj} from '@storybook/react-vite';
import {COLORS, SPACING} from '../../../shared/constants';
import type {Binder} from './binderRules';
import {STORY_BINDER_ENTRIES, STORY_BINDER_POOL} from './binderStoryData';
import {RuleLines} from './RuleLines';
import {startOf, useBinderDraft} from './useBinderDraft';

interface LinesProps {
  /** The binder whose rules the lines start from, or null for a new one. */
  binder: Binder | null;
  isMobile: boolean;
}

/** The lines over a draft of the story pool, at the width the window's rules column gives them. */
function StoryLines({binder, isMobile}: LinesProps) {
  const draft = useBinderDraft({start: startOf(binder), pool: STORY_BINDER_POOL, entries: STORY_BINDER_ENTRIES});
  return (
    <div style={{width: isMobile ? 358 : 612, padding: SPACING.xl, background: COLORS.surface}}>
      <RuleLines draft={draft} isMobile={isMobile} />
    </div>
  );
}

const binderWith = (name: string, rules: string): Binder => ({id: 'b1', name, scope: 'all', rules, pages: 4, cover: null, place: 0});

/**
 * The New binder window's "What it holds": one line for each kind of rule, its name on the left
 * and its choices on the right, or on a phone its name over them. Classification and Keyword
 * are dropdowns (`RulePick`).
 */
const meta: Meta<typeof StoryLines> = {
  title: 'Collection/Binders/RuleLines',
  component: StoryLines,
  tags: ['autodocs'],
  args: {binder: null, isMobile: false},
};

export default meta;
type Story = StoryObj<typeof meta>;

/** A new binder: nothing picked, so it holds every card. */
export const Empty: Story = {};

/** Amber legends: one ink, so Dual-ink cards shows beside it, and Legendary lit. */
export const AmberLegends: Story = {args: {binder: binderWith('Amber legends', 'ink=Amber&rarity=Legendary')}};

/** A rule on every line: two classifications as chips in their field, and Name has filled in. */
export const EveryKind: Story = {
  args: {
    binder: binderWith(
      'Everything',
      'q=Stitch&ink=Amber%2CSteel&type=Character&cost=2&keyword=Ward&classification=Hero%2CStoryborn&rarity=Legendary&inkwell=uninkable&inkmatch=dual',
    ),
  },
};

/** On a phone: each name over its choices, at the kit's touch size. */
export const Phone: Story = {args: {isMobile: true}, globals: {viewport: {value: 'mobile1'}}};

/** Every line picked on a phone. */
export const PhoneEveryKind: Story = {
  args: {...EveryKind.args, isMobile: true},
  globals: {viewport: {value: 'mobile1'}},
};
