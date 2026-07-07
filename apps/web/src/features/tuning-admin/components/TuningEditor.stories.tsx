import type {Meta, StoryObj} from '@storybook/react-vite';
import {TuningEditor} from './TuningEditor';

const meta: Meta<typeof TuningEditor> = {
  title: 'TuningAdmin/TuningEditor',
  component: TuningEditor,
  args: {token: 'ghp_example'},
  decorators: [
    (Story) => (
      <div style={{maxWidth: 1000, padding: 16}}>
        <Story />
      </div>
    ),
  ],
};
export default meta;

export const Default: StoryObj<typeof TuningEditor> = {};
