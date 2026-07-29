import 'react-loading-skeleton/dist/skeleton.css';
// Load the app's @font-face (Plus Jakarta Sans + Marcellus, served from /public/fonts
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
    // SB10-correct canvas backgrounds (#512): the runtime reads {options},
    // not the pre-SB8 {default} / {values} shapes the story files used to set.
    backgrounds: {
      options: {
        dark: {name: 'Inkweave dark', value: '#0d0d14'},
        surface: {name: 'Surface', value: '#1a1a2e'},
      },
    },
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
  initialGlobals: {
    backgrounds: {value: 'dark'},
  },
};

export default preview;
