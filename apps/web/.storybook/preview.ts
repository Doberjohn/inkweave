import type { Preview } from '@storybook/react-vite';
import { MotionGlobalConfig } from 'framer-motion';

if (typeof window !== 'undefined' && window.navigator.userAgent.includes('Chromatic')) {
  MotionGlobalConfig.skipAnimations = true;
}

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
       color: /(background|color)$/i,
       date: /Date$/i,
      },
    },
  },
};

export default preview;