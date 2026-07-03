import {describe, it, expect, vi} from 'vitest';
import {renderHook, act} from '@testing-library/react';
import type {LorcanaCard} from 'inkweave-synergy-engine';

// The hook pulls a token + card list from context; stub both so the hook can run
// in isolation. The token is present so canPublish hinges on card + image only.
vi.mock('../../../shared/hooks/useGithubToken', () => ({
  useGithubToken: () => ({token: 'tok', setToken: () => {}, clearToken: () => {}}),
}));
vi.mock('../../../shared/contexts/CardDataContext', () => ({
  useCardDataContext: () => ({cards: []}),
}));

import {useImageAdmin} from '../useImageAdmin';

function card(id: string): LorcanaCard {
  return {id, name: id, fullName: id, cost: 1, ink: 'Amber', inkwell: true, type: 'Character'};
}

describe('useImageAdmin', () => {
  it('clears the staged image when a different card is selected', async () => {
    const {result} = renderHook(() => useImageAdmin());

    act(() => result.current.selectCard(card('A')));
    await act(async () => {
      await result.current.onImageChange(new File(['x'], 'a.png', {type: 'image/png'}));
    });
    expect(result.current.canPublish).toBe(true);

    // Switching cards must drop card A's upload — otherwise it would publish
    // against card B's id.
    act(() => result.current.selectCard(card('B')));
    expect(result.current.newImageUrl).toBeNull();
    expect(result.current.canPublish).toBe(false);
  });
});
