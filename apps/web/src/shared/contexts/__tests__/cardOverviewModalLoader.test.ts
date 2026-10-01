import {describe, it, expect, afterEach, vi} from 'vitest';

vi.mock('../../../features/synergies/components/CardOverviewModal', () => ({CardOverviewModal: () => null}));

// The loader remembers a loaded chunk at module level, so each test loads a fresh copy.
async function freshLoader() {
  vi.resetModules();
  return import('../cardOverviewModalLoader');
}

// Lets the mocked dynamic import settle.
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('warmCardOverviewModalOnFirstInteraction', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('downloads the modal on the first interaction once the page has loaded', async () => {
    const loader = await freshLoader();
    const stop = loader.warmCardOverviewModalOnFirstInteraction();
    await flush();
    expect(loader.getLoadedCardOverviewModal()).toBeNull();

    window.dispatchEvent(new Event('scroll'));
    await flush();
    expect(loader.getLoadedCardOverviewModal()).not.toBeNull();
    stop();
  });

  it('waits for load when the first interaction comes earlier', async () => {
    const loader = await freshLoader();
    vi.spyOn(document, 'readyState', 'get').mockReturnValue('loading');
    const stop = loader.warmCardOverviewModalOnFirstInteraction();

    window.dispatchEvent(new Event('pointerdown'));
    await flush();
    expect(loader.getLoadedCardOverviewModal()).toBeNull();

    window.dispatchEvent(new Event('load'));
    await flush();
    expect(loader.getLoadedCardOverviewModal()).not.toBeNull();
    stop();
  });

  it('stops listening once cleaned up', async () => {
    const loader = await freshLoader();
    loader.warmCardOverviewModalOnFirstInteraction()();

    window.dispatchEvent(new Event('keydown'));
    await flush();
    expect(loader.getLoadedCardOverviewModal()).toBeNull();
  });
});
