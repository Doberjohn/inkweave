import {describe, it, expect} from 'vitest';
import {render, screen} from '@testing-library/react';
import {Header} from '../Header';

describe('Header', () => {
  const defaultProps = {
    totalCards: 500,
    isLoading: false,
  };

  it('should render the app title', () => {
    render(<Header {...defaultProps} />);

    expect(screen.getByRole('heading', {name: /inkweave/i})).toBeInTheDocument();
  });

  it('should show loading state', () => {
    render(<Header {...defaultProps} isLoading={true} />);

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('should show card count when loaded', () => {
    render(<Header {...defaultProps} totalCards={1234} isLoading={false} />);

    expect(screen.getByText(/1234 cards loaded/i)).toBeInTheDocument();
  });
});
