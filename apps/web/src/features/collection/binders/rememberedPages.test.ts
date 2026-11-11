import {afterEach, describe, expect, it, vi} from 'vitest';
import {rememberedPages} from './rememberedPages';
import {pagesKey} from '../collectionStorage';

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('rememberedPages', () => {
  it('reads back the size kept for the account, and none for another', () => {
    localStorage.setItem(pagesKey('me'), '3');
    expect(rememberedPages('me')).toBe(3);
    expect(rememberedPages('you')).toBeNull();
  });

  it('reads a value that is not exactly a page size as none', () => {
    for (const value of ['7', 'x', '', '3.5', '2.0', ' 3 ']) {
      localStorage.setItem(pagesKey('me'), value);
      expect(rememberedPages('me')).toBeNull();
    }
  });

  it('reads none, without throwing, where the browser refuses its storage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    expect(rememberedPages('me')).toBeNull();
  });
});
