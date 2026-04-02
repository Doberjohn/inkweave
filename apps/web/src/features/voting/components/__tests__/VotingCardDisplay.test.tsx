import {describe, it, expect, vi} from 'vitest';
import {render, screen, fireEvent} from '@testing-library/react';
import {VotingCardDisplay} from '../VotingCardDisplay';
import {createCard} from '../../../../shared/test-utils';

vi.mock('../../../../shared/components', () => ({
  CardImage: ({alt, width}: {alt: string; width: number}) => <img alt={alt} data-width={width} />,
  CardLightbox: ({alt, onClose}: {alt: string; onClose: () => void}) => <div data-testid="card-lightbox" data-alt={alt}><button onClick={onClose}>Close</button></div>,
}));

const cardWithVersion = createCard({
  id: 'elsa-1',
  fullName: 'Elsa - Ice Queen',
  name: 'Elsa',
  imageUrl: '/images/elsa.avif',
});

const cardWithoutVersion = createCard({
  id: 'genie-1',
  fullName: 'Genie',
  name: 'Genie',
  imageUrl: '/images/genie.avif',
});

describe('VotingCardDisplay', () => {
  it('renders card image with correct alt text', () => {
    render(<VotingCardDisplay card={cardWithVersion} />);
    expect(screen.getByAltText('Elsa - Ice Queen')).toBeTruthy();
  });

  it('mobile: shows card name', () => {
    render(<VotingCardDisplay card={cardWithVersion} isMobile />);
    expect(screen.getByText('Elsa')).toBeTruthy();
  });

  it('mobile: shows version text when card has version', () => {
    render(<VotingCardDisplay card={cardWithVersion} isMobile />);
    expect(screen.getByText('Ice Queen')).toBeTruthy();
  });

  it('mobile: does not show version when name has no dash', () => {
    render(<VotingCardDisplay card={cardWithoutVersion} isMobile />);
    expect(screen.getByText('Genie')).toBeTruthy();
    expect(screen.queryByText('null')).toBeNull();
  });

  it('mobile: click opens lightbox', () => {
    render(<VotingCardDisplay card={cardWithVersion} isMobile />);
    expect(screen.queryByTestId('card-lightbox')).toBeNull();
    fireEvent.click(screen.getByAltText('Elsa - Ice Queen'));
    expect(screen.getByTestId('card-lightbox')).toBeTruthy();
  });

  it('mobile: lightbox close button works', () => {
    render(<VotingCardDisplay card={cardWithVersion} isMobile />);
    fireEvent.click(screen.getByAltText('Elsa - Ice Queen'));
    expect(screen.getByTestId('card-lightbox')).toBeTruthy();
    fireEvent.click(screen.getByText('Close'));
    expect(screen.queryByTestId('card-lightbox')).toBeNull();
  });

  it('mobile: does not show lightbox initially', () => {
    render(<VotingCardDisplay card={cardWithVersion} isMobile />);
    expect(screen.queryByTestId('card-lightbox')).toBeNull();
  });

  it('desktop: does not show card name text', () => {
    render(<VotingCardDisplay card={cardWithVersion} />);
    expect(screen.queryByText('Elsa')).toBeNull();
    expect(screen.queryByText('Ice Queen')).toBeNull();
  });

  it('renders (does not crash) with highlighted prop', () => {
    const {container} = render(<VotingCardDisplay card={cardWithVersion} highlighted />);
    expect(container.firstChild).toBeTruthy();
  });
});
