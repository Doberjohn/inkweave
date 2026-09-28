import {describe, it, expect, vi, beforeEach} from 'vitest';
import {createRef, useRef, useState} from 'react';
import {render, screen, fireEvent, act, createEvent} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {SearchBottomSheet, type SearchBottomSheetHandle} from '../SearchBottomSheet';

const {mockOpenCardModal, mockSearchCardsByName} = vi.hoisted(() => ({
  mockOpenCardModal: vi.fn(),
  mockSearchCardsByName: vi.fn(),
}));

const ELSA = {id: 'elsa-1', fullName: 'Elsa - Snow Queen', ink: 'Amethyst'} as LorcanaCard;

// Mock navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {...actual, useNavigate: () => mockNavigate};
});

// Mock card data context
vi.mock('../../contexts/CardDataContext', () => ({
  useCardDataContext: () => ({cards: []}),
}));

// Mock card modal context — SearchBottomSheet now opens cards via openCardModal
vi.mock('../../contexts/CardModalContext', () => ({
  useCardModal: () => ({
    selectedCardId: null,
    openCardModal: mockOpenCardModal,
    closeCardModal: vi.fn(),
  }),
}));

// Mock card loader
vi.mock('../../../features/cards/loader', () => ({
  smallImageUrl: (card: {id: string}) => `/images/${card.id}.avif`,
  searchCardsByName: mockSearchCardsByName,
  parseSetOrder: () => 0,
}));

describe('SearchBottomSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchCardsByName.mockReturnValue([]);
    localStorage.clear(); // selecting a card records it as a recent search
  });

  const renderSheet = (isOpen = true) => {
    const onClose = vi.fn();
    const {unmount} = render(
      <MemoryRouter>
        <SearchBottomSheet isOpen={isOpen} onClose={onClose} returnFocusRef={createRef()} />
      </MemoryRouter>,
    );
    return {onClose, unmount};
  };

  /** AppLayout's wiring: the trigger focuses the proxy in its tap handler, then opens the sheet. */
  function SheetWithTrigger() {
    const [isOpen, setIsOpen] = useState(false);
    const sheetRef = useRef<SearchBottomSheetHandle>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const open = () => {
      sheetRef.current?.focusProxy();
      setIsOpen(true);
    };
    return (
      <MemoryRouter>
        <button ref={triggerRef} onClick={open}>
          Search cards
        </button>
        <SearchBottomSheet
          ref={sheetRef}
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          returnFocusRef={triggerRef}
        />
      </MemoryRouter>
    );
  }

  /** Tap the trigger and let the sheet's delayed initial focus land on its input. */
  const openFromTrigger = () => {
    render(<SheetWithTrigger />);
    fireEvent.click(screen.getByRole('button', {name: 'Search cards'}));
    act(() => {
      vi.advanceTimersByTime(100);
    });
    return screen.getByRole('button', {name: 'Search cards'});
  };

  /** Type a query, let the autocomplete debounce settle, then pick ELSA from the results. */
  const selectElsa = () => {
    mockSearchCardsByName.mockReturnValue([ELSA]);
    fireEvent.change(screen.getByTestId('search-sheet-input'), {target: {value: 'Elsa'}});
    act(() => {
      vi.advanceTimersByTime(150);
    });
    fireEvent.mouseDown(screen.getByRole('option'));
  };

  it('should navigate to browse on Enter key with query', () => {
    const {onClose} = renderSheet();

    const input = screen.getByTestId('search-sheet-input');
    fireEvent.change(input, {target: {value: 'Elsa'}});
    fireEvent.keyDown(input, {key: 'Enter'});

    expect(mockNavigate).toHaveBeenCalledWith('/browse?q=Elsa');
    expect(onClose).toHaveBeenCalled();
  });

  it('should not navigate on Enter with empty query', () => {
    renderSheet();

    const input = screen.getByTestId('search-sheet-input');
    fireEvent.keyDown(input, {key: 'Enter'});

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('should not navigate on Enter with whitespace-only query', () => {
    renderSheet();

    const input = screen.getByTestId('search-sheet-input');
    fireEvent.change(input, {target: {value: '   '}});
    fireEvent.keyDown(input, {key: 'Enter'});

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('should close on Escape key', () => {
    const {onClose} = renderSheet();

    // useDialogFocus listens on document, so fire Escape there
    fireEvent.keyDown(document, {key: 'Escape'});

    expect(onClose).toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('should encode special characters in search query', () => {
    const {onClose} = renderSheet();

    const input = screen.getByTestId('search-sheet-input');
    fireEvent.change(input, {target: {value: 'Mr. Smee'}});
    fireEvent.keyDown(input, {key: 'Enter'});

    expect(mockNavigate).toHaveBeenCalledWith('/browse?q=Mr.%20Smee');
    expect(onClose).toHaveBeenCalled();
  });

  it('opens the selected card once the close animation has a head start', () => {
    vi.useFakeTimers();
    try {
      const {onClose} = renderSheet();
      selectElsa();
      expect(onClose).toHaveBeenCalled();
      expect(mockOpenCardModal).not.toHaveBeenCalled();
      act(() => {
        vi.advanceTimersByTime(50);
      });
      expect(mockOpenCardModal).toHaveBeenCalledWith('elsa-1');
    } finally {
      vi.useRealTimers();
    }
  });

  it('opens a pending card on unmount instead of leaking its timer', () => {
    vi.useFakeTimers();
    try {
      const {unmount} = renderSheet();
      selectElsa();
      expect(vi.getTimerCount()).toBe(1); // only the 50ms modal-open timer is pending
      unmount();
      // A timer outliving teardown can set state in a torn-down tree (CI's "window is not
      // defined" crash), so unmounting flushes the pending open instead of leaving it running.
      expect(vi.getTimerCount()).toBe(0);
      expect(mockOpenCardModal).toHaveBeenCalledWith('elsa-1');
    } finally {
      vi.useRealTimers();
    }
  });

  it('returns focus to the trigger, not the hidden proxy input, when closed', () => {
    vi.useFakeTimers();
    try {
      const trigger = openFromTrigger();
      fireEvent.keyDown(document, {key: 'Escape'});
      expect(trigger).toHaveFocus();
    } finally {
      vi.useRealTimers();
    }
  });

  it('consumes the submitting Enter so it cannot press the trigger that regains focus', () => {
    vi.useFakeTimers();
    try {
      const trigger = openFromTrigger();
      const input = screen.getByTestId('search-sheet-input');
      fireEvent.change(input, {target: {value: 'Elsa'}});
      // Focus returns to the trigger while this keydown is still dispatching. A browser then
      // runs Enter's default action on the trigger (a click), which would reopen the sheet.
      const enter = createEvent.keyDown(input, {key: 'Enter'});
      fireEvent(input, enter);
      expect(trigger).toHaveFocus();
      expect(enter.defaultPrevented).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('leaves focus on the trigger when a card picked from the results opens its modal', () => {
    vi.useFakeTimers();
    try {
      // The card modal saves whatever holds focus when it opens as its own focus-return target.
      let focusedWhenModalOpened: Element | null = null;
      mockOpenCardModal.mockImplementationOnce(() => {
        focusedWhenModalOpened = document.activeElement;
      });
      const trigger = openFromTrigger();
      selectElsa();
      act(() => {
        vi.advanceTimersByTime(50);
      });
      expect(focusedWhenModalOpened).toBe(trigger);
    } finally {
      vi.useRealTimers();
    }
  });
});
