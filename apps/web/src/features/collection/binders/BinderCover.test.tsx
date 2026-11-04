import {describe, it, expect, vi} from 'vitest';
import {fireEvent, render, screen} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {createCard} from '../../../shared/test-utils';
import {BinderCover, type BinderCoverProps} from './BinderCover';

const ART = createCard({id: 'amber-legend', imageUrl: '/card-images-preview/14085.avif'});

function renderCover(over: Partial<BinderCoverProps> = {}) {
  const props: BinderCoverProps = {
    name: 'Amber',
    rule: 'Amber ink',
    cover: ART,
    figures: {complete: 293, master: 100, cards: 625},
    promos: false,
    to: '/browse?binder=all&custom=b1',
    onOpen: vi.fn(),
    compact: false,
    ...over,
  };
  const view = render(
    <MemoryRouter>
      <BinderCover {...props} />
    </MemoryRouter>,
  );
  return {props, view};
}

describe('BinderCover', () => {
  it('is a link to its binder, named from what it shows', () => {
    renderCover();
    const link = screen.getByRole('link', {name: 'Amber, Amber ink, 46%, 293 of 625 cards'});
    expect(link).toHaveAttribute('href', '/browse?binder=all&custom=b1');
  });

  it('keeps the binder\'s name out of every attribute', () => {
    const {view} = renderCover({name: 'Zz secret name'});
    const attributes = [...view.container.querySelectorAll('*')].flatMap((el) => [...el.attributes].map((a) => a.value));
    expect(attributes.some((value) => value.includes('Zz secret'))).toBe(false);
  });

  it('counts promos for a binder of promo sets, and says the short count on a phone', () => {
    renderCover({promos: true, figures: {complete: 2, master: 1, cards: 16}, compact: true});
    expect(screen.getByText('2 / 16')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAccessibleName('Amber, Amber ink, 12%, 2 of 16 promos');
  });

  it('shows an empty sleeve with no card, and a dash for rules that hold none', () => {
    const {view} = renderCover({cover: null, figures: {complete: 0, master: 0, cards: 0}});
    expect(view.container.querySelector('img')).toBeNull();
    expect(screen.getByText('–')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAccessibleName('Amber, Amber ink, no cards');
  });

  it('tells the shelf when followed', () => {
    const {props} = renderCover();
    fireEvent.click(screen.getByRole('link'));
    expect(props.onOpen).toHaveBeenCalledOnce();
  });
});
