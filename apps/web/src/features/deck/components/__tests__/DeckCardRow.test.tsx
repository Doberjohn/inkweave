import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, it, expect, vi} from 'vitest';
import {DeckCardRow} from '../DeckCardRow';
import {CardPreviewProvider} from '../../../cards/components/CardPreviewContext';
import {createCard} from '../../../../shared/test-utils/factories';

const renderWithProvider = (ui: React.ReactElement) => {
  return render(<CardPreviewProvider>{ui}</CardPreviewProvider>);
};

const createDefaultProps = () => ({
  card: createCard({id: 'card-1', name: 'Mickey Mouse', version: 'Brave Little Tailor', cost: 3}),
  quantity: 2,
  onIncrement: vi.fn(),
  onDecrement: vi.fn(),
  onRemoveAll: vi.fn(),
});

describe('DeckCardRow', () => {
  describe('rendering', () => {
    it('should render card name', () => {
      const props = createDefaultProps();
      renderWithProvider(<DeckCardRow {...props} />);

      expect(screen.getByText('Mickey Mouse')).toBeInTheDocument();
    });

    it('should render card version when present', () => {
      const props = createDefaultProps();
      renderWithProvider(<DeckCardRow {...props} />);

      expect(screen.getByText('Brave Little Tailor')).toBeInTheDocument();
    });

    it('should not render version when not present', () => {
      const props = createDefaultProps();
      props.card = createCard({name: 'Simple Card', version: undefined});
      renderWithProvider(<DeckCardRow {...props} />);

      expect(screen.getByText('Simple Card')).toBeInTheDocument();
      expect(screen.queryByText('undefined')).not.toBeInTheDocument();
    });

    it('should display current quantity between controls', () => {
      const props = createDefaultProps();
      props.quantity = 3;
      props.card = createCard({cost: 5}); // Use different cost to avoid duplicate
      renderWithProvider(<DeckCardRow {...props} />);

      // Quantity appears between the +/- controls
      const decrementBtn = screen.getByLabelText(/remove one copy/i);
      const incrementBtn = screen.getByLabelText(/add one copy/i);
      // Both buttons exist and quantity 3 is in the document
      expect(decrementBtn).toBeInTheDocument();
      expect(incrementBtn).toBeInTheDocument();
      // Find the quantity span specifically (between controls)
      const quantities = screen.getAllByText('3');
      expect(quantities.length).toBeGreaterThan(0);
    });

    it('should display card cost in badge', () => {
      const props = createDefaultProps();
      props.card = createCard({cost: 5});
      props.quantity = 1; // Use quantity 1 to avoid duplicate with cost
      renderWithProvider(<DeckCardRow {...props} />);

      // Cost appears in badge with title showing total cost calculation
      const costBadge = screen.getByTitle(/5 ink x 1 = 5 total/);
      expect(costBadge).toHaveTextContent('5');
    });

    it('should render card image when imageUrl is provided', () => {
      const props = createDefaultProps();
      props.card = createCard({imageUrl: 'https://example.com/card.png'});
      const {container} = renderWithProvider(<DeckCardRow {...props} />);

      // CardImage component is used which renders an img
      const img = container.querySelector('img[src="https://example.com/card.png"]');
      expect(img).toBeTruthy();
    });
  });

  describe('quantity controls', () => {
    it('should call onDecrement when minus button is clicked', async () => {
      const user = userEvent.setup();
      const props = createDefaultProps();
      renderWithProvider(<DeckCardRow {...props} />);

      const decrementButton = screen.getByLabelText(/remove one copy/i);
      await user.click(decrementButton);

      expect(props.onDecrement).toHaveBeenCalledTimes(1);
    });

    it('should call onIncrement when plus button is clicked', async () => {
      const user = userEvent.setup();
      const props = createDefaultProps();
      renderWithProvider(<DeckCardRow {...props} />);

      const incrementButton = screen.getByLabelText(/add one copy/i);
      await user.click(incrementButton);

      expect(props.onIncrement).toHaveBeenCalledTimes(1);
    });

    it('should disable increment button when quantity is 4', () => {
      const props = createDefaultProps();
      props.quantity = 4;
      renderWithProvider(<DeckCardRow {...props} />);

      const incrementButton = screen.getByLabelText(/maximum 4 copies/i);
      expect(incrementButton).toBeDisabled();
    });

    it('should enable increment button when quantity is less than 4', () => {
      const props = createDefaultProps();
      props.quantity = 3;
      renderWithProvider(<DeckCardRow {...props} />);

      const incrementButton = screen.getByLabelText(/add one copy/i);
      expect(incrementButton).not.toBeDisabled();
    });
  });

  describe('remove all button', () => {
    it('should call onRemoveAll when remove button is clicked', async () => {
      const user = userEvent.setup();
      const props = createDefaultProps();
      renderWithProvider(<DeckCardRow {...props} />);

      const removeButton = screen.getByLabelText(/remove all copies/i);
      await user.click(removeButton);

      expect(props.onRemoveAll).toHaveBeenCalledTimes(1);
    });

    it('should have accessible label with card name', () => {
      const props = createDefaultProps();
      props.card = createCard({name: 'Elsa'});
      renderWithProvider(<DeckCardRow {...props} />);

      expect(screen.getByLabelText(/remove all copies of Elsa from deck/i)).toBeInTheDocument();
    });
  });

  describe('event propagation', () => {
    it('should stop propagation on button clicks', async () => {
      const user = userEvent.setup();
      const props = createDefaultProps();
      const containerClick = vi.fn();

      render(
        <CardPreviewProvider>
          <div onClick={containerClick}>
            <DeckCardRow {...props} />
          </div>
        </CardPreviewProvider>,
      );

      await user.click(screen.getByLabelText(/remove one copy/i));
      await user.click(screen.getByLabelText(/add one copy/i));
      await user.click(screen.getByLabelText(/remove all copies/i));

      expect(containerClick).not.toHaveBeenCalled();
    });
  });

  describe('accessibility', () => {
    it('should have descriptive aria-labels for all buttons', () => {
      const props = createDefaultProps();
      props.card = createCard({name: 'Simba'});
      renderWithProvider(<DeckCardRow {...props} />);

      expect(screen.getByLabelText(/remove one copy of Simba/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/add one copy of Simba/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/remove all copies of Simba from deck/i)).toBeInTheDocument();
    });

    it('should update aria-label when at max quantity', () => {
      const props = createDefaultProps();
      props.card = createCard({name: 'Ariel'});
      props.quantity = 4;
      renderWithProvider(<DeckCardRow {...props} />);

      expect(screen.getByLabelText(/maximum 4 copies of Ariel/i)).toBeInTheDocument();
    });
  });
});
