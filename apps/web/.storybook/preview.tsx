import 'react-loading-skeleton/dist/skeleton.css';
// Load the app's @font-face (Plus Jakarta Sans + Tinos, served from /public/fonts
// via staticDirs) so stories render in the real app fonts, not system fallbacks.
import '../src/index.css';
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
