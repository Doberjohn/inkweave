import type {Preview} from '@storybook/react-vite';
import {themes} from 'storybook/theming';

const preview: Preview = {
  decorators: [
    (Story) => (
      <div style={{background: '#0d0d14', minHeight: '100vh', padding: 0}}>
        <Story />
      </div>
    ),
  ],
  parameters: {
    layout: 'fullscreen',
    docs: {
      theme: themes.dark,
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;
