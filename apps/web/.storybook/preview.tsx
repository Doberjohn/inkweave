import 'react-loading-skeleton/dist/skeleton.css';
// The app's own stylesheet, as main.tsx loads it. Without it no story had the
// classes defined there: the card tiles' hover glow and press, the binder's
// unowned grey, the foil shimmer and every keyframe, so stories quietly differed
// from the app.
import '../src/index.css';
import type {Preview} from '@storybook/react-vite';
import {SkeletonTheme} from 'react-loading-skeleton';
import {themes} from 'storybook/theming';
import {COLORS} from '../src/shared/constants';

const preview: Preview = {
  decorators: [
    (Story) => (
      // AppLayout's one SkeletonTheme (#511): without it, skeletons render light grey here.
      <SkeletonTheme baseColor={COLORS.surfaceAlt} highlightColor={COLORS.surfaceHover}>
        <div style={{background: '#0d0d14', minHeight: '100vh', padding: 0}}>
          <Story />
        </div>
      </SkeletonTheme>
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
