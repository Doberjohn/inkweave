import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import {render, screen, fireEvent, act, waitFor} from '@testing-library/react';
import {CardPreviewPopover} from '../CardPreviewPopover';
import {CardPreviewProvider} from '../CardPreviewContext';
import {useCardPreview} from '../useCardPreview';
import {createCard} from '../../../../shared/test-utils';
import type {LorcanaCard} from '../../types';

// Test component to control preview state
function PreviewController({
  card,
  x = 100,
  y = 100,
  isTouchMode = false,
}: {
  card: LorcanaCard | null;
  x?: number;
  y?: number;
  isTouchMode?: boolean;
}) {
  const {showPreview, hidePreview} = useCardPreview();

  return (
    <div>
      {card && <button onClick={() => showPreview(card, x, y, isTouchMode)}>Show Preview</button>}
      <button onClick={hidePreview}>Hide Preview</button>
      <CardPreviewPopover />
    </div>
  );
}

function renderWithProvider(
  card: LorcanaCard | null,
  options: {x?: number; y?: number; isTouchMode?: boolean} = {},
) {
  return render(
    <CardPreviewProvider>
      <PreviewController card={card} {...options} />
    </CardPreviewProvider>,
  );
}

describe('CardPreviewPopover', () => {
  const mockCard = createCard({
    id: 'test-1',
    name: 'Elsa',
    fullName: 'Elsa - Snow Queen',
    cost: 5,
    ink: 'Sapphire',
    type: 'Character',
    imageUrl: 'https://example.com/elsa.jpg',
  });

  const locationCard = createCard({
    id: 'location-1',
    name: 'Arendelle Castle',
    fullName: 'Arendelle Castle - Frozen Palace',
    cost: 4,
    ink: 'Sapphire',
    type: 'Location',
    imageUrl: 'https://example.com/castle.jpg',
  });

  beforeEach(() => {
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(800);
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1024);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should not render when no card is selected', () => {
    render(
      <CardPreviewProvider>
        <CardPreviewPopover />
      </CardPreviewProvider>,
    );
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('should render card image when card is shown', () => {
    renderWithProvider(mockCard);
    act(() => {
      screen.getByText('Show Preview').click();
    });
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', mockCard.imageUrl);
    expect(img).toHaveAttribute('alt', mockCard.fullName);
  });

  it('should hide preview when hidePreview is called', async () => {
    renderWithProvider(mockCard);
    act(() => {
      screen.getByText('Show Preview').click();
    });
    expect(screen.getByRole('img')).toBeInTheDocument();
    act(() => {
      screen.getByText('Hide Preview').click();
    });
    await waitFor(() => {
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });
  });

  describe('Touch mode', () => {
    it('should render centered modal with dismiss hint in touch mode', () => {
      renderWithProvider(mockCard, {isTouchMode: true});
      act(() => {
        screen.getByText('Show Preview').click();
      });
      const hint = screen.getByRole('status');
      expect(hint).toHaveTextContent('Tap anywhere to dismiss');
    });

    it('should hide preview when dismissed', async () => {
      renderWithProvider(mockCard, {isTouchMode: true});
      act(() => {
        screen.getByText('Show Preview').click();
      });
      expect(screen.getByText('Tap anywhere to dismiss')).toBeInTheDocument();
      act(() => {
        screen.getByText('Hide Preview').click();
      });
      await waitFor(() => {
        expect(screen.queryByRole('img')).not.toBeInTheDocument();
      });
    });
  });

  describe('Desktop hover mode', () => {
    it.each([
      ['normal position', {x: 200, y: 300}],
      ['near right edge', {x: 900, y: 200}],
      ['near bottom', {x: 200, y: 700}],
      ['above viewport', {x: 200, y: -100}],
    ])('should use fixed positioning at %s', (_label, pos) => {
      renderWithProvider(mockCard, pos);
      act(() => {
        screen.getByText('Show Preview').click();
      });
      const container = screen.getByRole('img').parentElement;
      expect(container).toHaveStyle({position: 'fixed'});
    });

    it('should not be interactive in hover mode (pointerEvents: none)', () => {
      renderWithProvider(mockCard);
      act(() => {
        screen.getByText('Show Preview').click();
      });
      const container = screen.getByRole('img').parentElement;
      expect(container).toHaveStyle({pointerEvents: 'none'});
    });
  });

  describe('Location cards', () => {
    it('should render location card with rotation', () => {
      renderWithProvider(locationCard);
      act(() => {
        screen.getByText('Show Preview').click();
      });
      const rotatedContainer = screen.getByRole('img').parentElement;
      expect(rotatedContainer).toHaveStyle({transform: 'rotate(90deg)'});
    });
  });

  describe('Fallback placeholder', () => {
    it('should render fallback when image has no URL', () => {
      renderWithProvider(createCard({...mockCard, imageUrl: undefined}));
      act(() => {
        screen.getByText('Show Preview').click();
      });
      expect(screen.getByText(mockCard.cost.toString())).toBeInTheDocument();
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });

    it('should render fallback when image fails to load', () => {
      renderWithProvider(mockCard);
      act(() => {
        screen.getByText('Show Preview').click();
      });
      fireEvent.error(screen.getByRole('img'));
      expect(screen.getByText(mockCard.cost.toString())).toBeInTheDocument();
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });
  });
});
