import type {Meta, StoryObj} from '@storybook/react-vite';
import {useState} from 'react';
import {RevealAdminForm} from './RevealAdminForm';
import type {RevealCardForm} from '../buildPreviewCard';

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

function Harness({errors}: {errors: Record<string, string>}) {
  const [form, setForm] = useState(initial);
  const [imageName, setImageName] = useState<string | null>('mei.png');
  return (
    <div style={{maxWidth: 420}}>
      <RevealAdminForm
        form={form}
        errors={errors}
        imageName={imageName}
        onChange={(patch) => setForm((f) => ({...f, ...patch}))}
        onImageChange={(file) => setImageName(file?.name ?? null)}
      />
    </div>
  );
}

export const Default: Story = {render: () => <Harness errors={{}} />};
export const WithErrors: Story = {
  render: () => <Harness errors={{collectorNumber: 'Card id 13050 already exists', image: 'Upload a card image'}} />,
};
