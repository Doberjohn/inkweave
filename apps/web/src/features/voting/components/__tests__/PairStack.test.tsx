import {describe, it, expect, vi} from 'vitest';
import {render, screen} from '@testing-library/react';
import {PairStack} from '../PairStack';
import {createCard} from '../../../../shared/test-utils';
import type {PairPreview} from '../../hooks/usePairQueue';

vi.mock('../../../../shared/components', () => ({
  CardImage: ({alt, width}: {alt: string; width: number}) => (
    <div data-testid="card-image" data-alt={alt} data-width={width} />
  ),
}));

function makePair(idA: string, idB: string): PairPreview {
  return {
    cardA: createCard({id: idA, fullName: `Card ${idA}`}),
    cardB: createCard({id: idB, fullName: `Card ${idB}`}),
  };
}

describe('PairStack', () => {
  it('returns null for empty pairs array', () => {
    const {container} = render(<PairStack pairs={[]} side="left" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders card images for each pair', () => {
    const pairs = [makePair('1', '2'), makePair('3', '4')];
    render(<PairStack pairs={pairs} side="left" />);
    const images = screen.getAllByTestId('card-image');
    expect(images).toHaveLength(4); // 2 pairs x 2 cards
  });

  it('renders max 3 pairs even if more provided', () => {
    const pairs = [
      makePair('1', '2'),
      makePair('3', '4'),
      makePair('5', '6'),
      makePair('7', '8'),
    ];
    render(<PairStack pairs={pairs} side="left" />);
    const images = screen.getAllByTestId('card-image');
    expect(images).toHaveLength(6); // 3 pairs x 2 cards (4th pair ignored)
  });

  it('renders 2 images per pair (card A and card B)', () => {
    const pairs = [makePair('a', 'b')];
    render(<PairStack pairs={pairs} side="left" />);
    const images = screen.getAllByTestId('card-image');
    expect(images).toHaveLength(2);
    expect(images[0]).toHaveAttribute('data-alt', 'Card a');
    expect(images[1]).toHaveAttribute('data-alt', 'Card b');
  });

  it('left side: images rendered', () => {
    const pairs = [makePair('1', '2')];
    const {container} = render(<PairStack pairs={pairs} side="left" />);
    expect(container.firstChild).not.toBeNull();
    expect(screen.getAllByTestId('card-image')).toHaveLength(2);
  });

  it('right side: images rendered', () => {
    const pairs = [makePair('1', '2')];
    const {container} = render(<PairStack pairs={pairs} side="right" />);
    expect(container.firstChild).not.toBeNull();
    expect(screen.getAllByTestId('card-image')).toHaveLength(2);
  });
});
