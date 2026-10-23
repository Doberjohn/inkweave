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

/** A held module: `release()` lets its requests through; `caught()` counts the requests held so far. */
export interface HeldModule {
  release: () => void;
  caught: () => number;
}

/**
 * Holds the requests for `name`'s module (see lazyModuleUrl) until release() runs. Hold before the
 * tab's first navigation: WebKit answers a module an earlier page in the same tab loaded from its
 * own copy, with no request a route sees (#923), so a hold set later can catch nothing.
 */
export async function holdLazyModule(page: Page, name: string): Promise<HeldModule> {
  let release!: () => void;
  let caught = 0;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route(lazyModuleUrl(name), async (route) => {
    caught += 1;
    await held;
    await route.continue();
  });
  return {release, caught: () => caught};
}
