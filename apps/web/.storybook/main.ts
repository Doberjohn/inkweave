import type {StorybookConfig} from '@storybook/react-vite';

// The app build's own plugins: the PWA, the startup-groups guard, whose modules a Storybook build
// never loads, and the collection code guard, since the stories load the collection whatever the
// flags say.
const SKIPPED_PLUGINS =
  /^(vite-plugin-pwa|inkweave:startup-groups-guard$|inkweave:collection-code-guard$)/;

const config: StorybookConfig = {
  stories: [
    '../src/**/*.mdx',
    '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)',
    // inkweave-ui's stories: one Storybook for the app and the package. check:stories fails a
    // story file none of these globs loads.
    '../../../packages/ui/src/**/*.stories.@(ts|tsx)',
  ],
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
        (p) => !(p && typeof p === 'object' && 'name' in p && SKIPPED_PLUGINS.test(String(p.name))),
      );
    return config;
  },
};
export default config;
