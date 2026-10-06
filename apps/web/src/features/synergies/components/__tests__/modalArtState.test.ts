import {describe, it, expect, vi} from 'vitest';
import {act, renderHook} from '@testing-library/react';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {createCard} from '../../../../shared/test-utils';
import {useCardTranslation, useModalPrinting} from '../modalArtState';

vi.mock('../../../../shared/lib/analytics', () => ({trackEvent: vi.fn()}));

// An English card whose Epic is known only from an Italian scan, like Baymax's (#681).
const baymax = createCard({
  id: '14085',
  variants: [{id: '14213', rarity: 'Epic', number: 213, scanLanguage: 'it'}],
});

/** The modal's two art hooks, wired as CardOverviewModal wires them. */
function renderArtState(card: LorcanaCard) {
  return renderHook(
    ({inComparison}) => {
      const printing = useModalPrinting(card, {isOpen: true, inComparison});
      return {printing, translation: useCardTranslation(card, true, printing)};
    },
    {initialProps: {inComparison: false}},
  );
}

describe('useCardTranslation', () => {
  // A comparison resets the printing without a pick or a swipe, so only a rule that reads the
  // printing on screen can catch it.
  it('clears the translation when a comparison brings the English Standard printing back', () => {
    const {result, rerender} = renderArtState(baymax);
    act(() => result.current.printing?.pick(1));
    act(() => result.current.translation?.toggle());
    expect(result.current.translation?.shown).toBe(true);

    rerender({inComparison: true});
    rerender({inComparison: false});

    expect(result.current.printing?.index).toBe(0);
    expect(result.current.translation).toMatchObject({shown: false, language: undefined});
  });

  it('keeps the translation between two foreign scans, in the language now shown', () => {
    const {result} = renderArtState({...baymax, scanLanguage: 'ja'});
    act(() => result.current.translation?.toggle());

    act(() => result.current.printing?.pick(1));

    expect(result.current.translation).toMatchObject({shown: true, language: 'it'});
  });
});
