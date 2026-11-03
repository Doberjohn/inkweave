import type {Page} from '@playwright/test';

/** Answers `pattern` with a 503 until the function it returns lets requests through. */
export async function failUntilLetThrough(page: Page, pattern: string): Promise<() => void> {
  let failing = true;
  await page.route(pattern, (route) => (failing ? route.fulfill({status: 503, body: ''}) : route.continue()));
  return () => {
    failing = false;
  };
}
