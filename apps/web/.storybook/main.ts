import type {StorybookConfig} from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: [
    '@chromatic-com/storybook',
    '@storybook/addon-vitest',
    '@storybook/addon-a11y',
    '@storybook/addon-docs',
    '@storybook/addon-onboarding',
  ],
  framework: '@storybook/react-vite',
  viteFinal(config) {
    config.plugins = config.plugins
      ?.flat()
      .filter(
        (p) => !(p && typeof p === 'object' && 'name' in p && String(p.name).startsWith('vite-plugin-pwa')),
      );
    return config;
  },
};
export default config;
