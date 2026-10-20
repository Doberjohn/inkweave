import {describe, expect, it, vi} from 'vitest';
import {fireEvent, render, screen} from '@testing-library/react';
import {VoteGroupTabs} from '../VoteGroupTabs';
import {TIER_COLORS} from '../../../../shared/constants';

const GROUPS = [
  {key: 'assessment', label: 'Assessment', accent: TIER_COLORS.moderate.color},
  {key: 'rating', label: 'Rating', accent: TIER_COLORS.perfect.color},
  {key: 'practical', label: 'Practical', accent: TIER_COLORS.strong.color},
] as const;

type GroupKey = (typeof GROUPS)[number]['key'];

function renderTabs(activeTab: GroupKey, onTabChange = vi.fn()) {
  render(
    <VoteGroupTabs
      groups={GROUPS}
      activeTab={activeTab}
      onTabChange={onTabChange}
      answeredByGroup={{assessment: 1, rating: 2, practical: 0}}
    />,
  );
  return onTabChange;
}

const tab = (label: string) => screen.getByRole('tab', {name: new RegExp(`^${label}`)});

describe('VoteGroupTabs', () => {
  it('puts only the open tab in the Tab order, and only it names a panel', () => {
    renderTabs('rating');
    expect(tab('Rating')).toHaveAttribute('tabindex', '0');
    expect(tab('Rating')).toHaveAttribute('aria-controls', 'panel-rating');
    for (const label of ['Assessment', 'Practical']) {
      expect(tab(label)).toHaveAttribute('tabindex', '-1');
      expect(tab(label)).not.toHaveAttribute('aria-controls');
    }
  });

  it('ArrowRight selects and focuses the next tab, wrapping at the end', () => {
    const onTabChange = renderTabs('practical');
    fireEvent.keyDown(tab('Practical'), {key: 'ArrowRight'});
    expect(onTabChange).toHaveBeenCalledWith('assessment');
    expect(tab('Assessment')).toHaveFocus();
  });

  it('ArrowLeft selects and focuses the previous tab, wrapping at the start', () => {
    const onTabChange = renderTabs('assessment');
    fireEvent.keyDown(tab('Assessment'), {key: 'ArrowLeft'});
    expect(onTabChange).toHaveBeenCalledWith('practical');
    expect(tab('Practical')).toHaveFocus();
  });
});
