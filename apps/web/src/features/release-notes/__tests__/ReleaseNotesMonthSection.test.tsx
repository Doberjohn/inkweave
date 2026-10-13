import {describe, expect, it} from 'vitest';
import {render, screen, within} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {ReleaseNotesMonthSection} from '../ReleaseNotesMonthSection';
import type {ReleaseNotesMonth} from '../types';

const OCTOBER: ReleaseNotesMonth = {
  schemaVersion: 1,
  month: '2026-10',
  title: 'October 2026',
  summary: 'Set 14 lands, with a faster card page.',
  sections: {
    engine: [{title: 'Ramp scores', body: 'Ramp pairs score closer to how they play.'}],
    fixed: [{title: 'Card search', body: 'Search finds franchise names again.', prs: [803]}],
    new: [
      {
        title: 'Set 14 is out',
        body: 'Every Set 14 card now has its synergies.',
        highlight: true,
        link: {label: 'Browse the cards', to: '/browse'},
        prs: [801, 802],
      },
    ],
  },
  behindTheScenes: 'Plus 12 behind-the-scenes changes.',
};

function renderMonth(notes: ReleaseNotesMonth = OCTOBER) {
  return render(
    <MemoryRouter>
      <ReleaseNotesMonthSection notes={notes} />
    </MemoryRouter>,
  );
}

describe('ReleaseNotesMonthSection', () => {
  it('names its region after the month and anchors it on the month id', () => {
    renderMonth();
    const region = screen.getByRole('region', {name: 'October 2026'});
    expect(region.id).toBe('2026-10');
    expect(within(region).getByText('Set 14 lands, with a faster card page.')).toBeTruthy();
  });

  it('shows its sections in the fixed order and leaves out the empty ones', () => {
    renderMonth();
    const headings = screen.getAllByRole('heading', {level: 3}).map((h) => h.textContent);
    expect(headings).toEqual(['New', 'Fixed', 'Synergy engine']);
  });

  it('tags only the highlighted items', () => {
    renderMonth();
    const tags = screen.getAllByText('Highlight');
    expect(tags).toHaveLength(1);
    expect(tags[0].closest('li')).toHaveTextContent('Set 14 is out');
  });

  it('links an item to its in-app page', () => {
    renderMonth();
    expect(screen.getByRole('link', {name: /Browse the cards/})).toHaveAttribute('href', '/browse');
  });

  it('closes with the behind-the-scenes line only when the month has one', () => {
    const {unmount} = renderMonth();
    expect(screen.getByText('Plus 12 behind-the-scenes changes.')).toBeTruthy();
    unmount();
    renderMonth({...OCTOBER, behindTheScenes: undefined});
    expect(screen.queryByText(/behind-the-scenes/)).toBeNull();
  });

  it('never shows PR numbers', () => {
    renderMonth();
    expect(screen.getByRole('region').textContent).not.toMatch(/80[123]/);
  });
});
