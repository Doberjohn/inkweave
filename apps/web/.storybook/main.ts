import type {StorybookConfig} from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  // Serve public/ so stories that reference public assets (card art, franchise/
  // playstyle art, /card-images-preview) render their images instead of 0x0 broken refs.
  staticDirs: ['../public'],
  // #512: addon-onboarding (starter leftover) and addon-vitest (registered but
  // never wired to a vitest browser project — silently inert) removed; re-add
  // addon-vitest together with its browser-mode project if story tests are wanted.
  addons: ['@chromatic-com/storybook', '@storybook/addon-a11y', '@storybook/addon-docs'],
  framework: '@storybook/react-vite',
  viteFinal(config) {
    config.plugins = config.plugins
      ?.flat()
      .filter(
        (p) =>
          !(
            p &&
            typeof p === 'object' &&
            'name' in p &&
            String(p.name).startsWith('vite-plugin-pwa')
          ),
      );
    return config;
  },
};
export default config;
