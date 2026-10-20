import type {Page} from '@playwright/test';

/**
 * The request that loads a lazily imported component, on either server the suite tests (#869):
 * its source file on the dev server (`/src/.../SearchBottomSheet.tsx`) or its chunk in a
 * production build (`/assets/SearchBottomSheet-<hash>.js`). `name` is the file's name without its
 * extension.
 */
function lazyModuleUrl(name: string): RegExp {
  return new RegExp(`/${name}(\\.tsx|-[\\w-]+\\.js)(\\?|$)`);
}

/** Holds the requests for `name`'s module (see lazyModuleUrl) until the returned release() runs. */
export async function holdLazyModule(page: Page, name: string): Promise<() => void> {
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route(lazyModuleUrl(name), async (route) => {
    await held;
    await route.continue();
  });
  return release;
}
