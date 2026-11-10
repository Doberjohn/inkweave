import {describe, it, expect, vi} from 'vitest';
import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {WhatsNewSection} from '../WhatsNewSection';

// The season's spotlights change every set, so the tab bar gets three fixed groups.
vi.mock('../setSpotlights', () => ({
  FRANCHISE_SPOTLIGHTS: [{config: {id: 'coco'}, data: {title: 'Coco'}}],
  SET_SPOTLIGHTS: [
    {eyebrow: 'Mechanics', items: [{id: 'boost', title: 'Boost'}]},
    {eyebrow: 'Tribes', items: [{id: 'pirates', title: 'Pirates'}]},
  ],
}));
vi.mock('../SpotlightHero', () => ({
  SpotlightHero: ({data}: {data: {title: string}}) => <p>{data.title}</p>,
}));

describe('WhatsNewSection tabs', () => {
  it('puts only the selected tab in the tab order', async () => {
    render(<WhatsNewSection />);
    await userEvent.tab();
    expect(screen.getByRole('tab', {name: 'New franchise'})).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole('tabpanel')).toHaveFocus();
  });

  it('moves focus and selection with the arrow keys, wrapping at the ends', async () => {
    render(<WhatsNewSection />);
    await userEvent.tab();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', {name: 'Mechanics'})).toHaveFocus();
    expect(screen.getByRole('tab', {name: 'Mechanics'})).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Boost')).toBeInTheDocument();

    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(screen.getByRole('tab', {name: 'Tribes'})).toHaveFocus();
    expect(screen.getByText('Pirates')).toBeInTheDocument();
  });
});
