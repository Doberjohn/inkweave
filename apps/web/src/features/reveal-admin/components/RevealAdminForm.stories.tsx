import type {Meta, StoryObj} from '@storybook/react-vite';
import {useState} from 'react';
import {RevealAdminForm} from './RevealAdminForm';
import type {RevealCardForm} from '../buildPreviewCard';
import {validateRevealCardForm} from '../validateForm';

const initial: RevealCardForm = {
  collectorNumber: '50',
  name: 'Mei',
  version: 'Red Panda',
  rarity: 'Rare',
  franchise: 'Turning Red',
  cost: '4',
  ink: 'Ruby',
  ink2: '',
  inkwell: true,
  type: 'Character',
  strength: '3',
  willpower: '5',
  lore: '2',
  moveCost: '',
  subtypes: 'Hero, Red Panda',
  keywords: 'Singer 5',
  fullText: 'PANDA POWER When you play this character, draw a card.',
};

const meta: Meta<typeof RevealAdminForm> = {
  title: 'Reveal Admin/RevealAdminForm',
  component: RevealAdminForm,
};
export default meta;
type Story = StoryObj<typeof RevealAdminForm>;

interface HarnessProps {
  errors: Record<string, string>;
  start?: RevealCardForm;
}

function Harness({errors, start = initial}: HarnessProps) {
  const [form, setForm] = useState(start);
  return (
    <div style={{maxWidth: 420}}>
      <RevealAdminForm
        form={form}
        errors={errors}
        onChange={(patch) => setForm((f) => ({...f, ...patch}))}
      />
    </div>
  );
}

export const Default: Story = {render: () => <Harness errors={{}} />};
export const WithErrors: Story = {
  render: () => <Harness errors={{collectorNumber: 'Card id 3021 already exists', image: 'Upload a card image'}} />,
};

/**
 * Kit Cloudkicker - Sure Shot (14192) as it was typed in. Click into Card Text and out
 * again: the words become glyphs (#635).
 */
export const SpelledOutCardText: Story = {
  render: () => (
    <Harness
      errors={{}}
      start={{
        ...initial,
        fullText:
          'Shift 3 (You may pay 3 Ink to play this on top of one of your characters named Kit Cloudkicker.)',
      }}
    />
  ),
};

const LEFTOVER_TEXT = 'PANDA POWER Your Strength wins every challenge.';

/** A glyph word house style cannot place: the validator's own message (on the page, Publish waits). */
export const LeftoverGlyphWord: Story = {
  render: () => {
    const form = {...initial, fullText: LEFTOVER_TEXT};
    const fullText = validateRevealCardForm(form, new Set(), 'mei.png').errors.fullText ?? '';
    return <Harness errors={{fullText}} start={form} />;
  },
};
