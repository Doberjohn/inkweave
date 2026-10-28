import {useState} from 'react';
import type {Meta, StoryObj} from '@storybook/react-vite';
import {COLORS, FONTS, FONT_SIZES, SPACING} from '../tokens/theme';
import {Switch} from './Switch';

const meta: Meta<typeof Switch> = {
  title: 'Shared/Switch',
  component: Switch,
  tags: ['autodocs'],
  parameters: {layout: 'padded'},
  decorators: [
    (Story) => (
      <div style={{color: COLORS.text, fontFamily: FONTS.body}}>
        <Story />
      </div>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof meta>;

/** A switch named by the text beside it, which flips it too. */
function Labelled({initial, disabled}: {initial: boolean; disabled?: boolean}) {
  const [on, setOn] = useState(initial);
  const id = `switch-${String(initial)}-${String(disabled)}`;
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: SPACING.md}}>
      <Switch id={id} checked={on} onCheckedChange={setOn} disabled={disabled} aria-labelledby={`${id}-label`} />
      <label id={`${id}-label`} htmlFor={id} style={{fontSize: `${FONT_SIZES.md}px`}}>
        Let my friends see my collection
      </label>
    </div>
  );
}

export const Off: Story = {render: () => <Labelled initial={false} />};

export const On: Story = {render: () => <Labelled initial />};

/** While a write is in flight, or the setting is still loading. */
export const Disabled: Story = {
  render: () => (
    <div style={{display: 'grid', gap: SPACING.lg}}>
      <Labelled initial={false} disabled />
      <Labelled initial disabled />
    </div>
  ),
};
