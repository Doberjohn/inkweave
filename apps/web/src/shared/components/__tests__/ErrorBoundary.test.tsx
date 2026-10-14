import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import {render, screen, fireEvent, waitFor} from '@testing-library/react';
import {ErrorBoundary} from '../ErrorBoundary';
import {PageLoadError} from '../../lib/lazyWithRetry';
import {loadSentry} from '../../lib/sentry';

const captureException = vi.hoisted(() => vi.fn());
vi.mock('../../lib/sentry', () => ({
  loadSentry: vi.fn(() => Promise.resolve({captureException})),
}));

// Component that throws an error
function ThrowError({shouldThrow}: {shouldThrow: boolean}) {
  if (shouldThrow) {
    throw new Error('Test error message');
  }
  return <div>Content rendered successfully</div>;
}

// A lazy page whose code couldn't download, even after a reload.
function FailToLoad(): never {
  throw new PageLoadError(new Error('chunk 404'));
}

const realLocation = window.location;

describe('ErrorBoundary', () => {
  // Suppress console.error for cleaner test output
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {configurable: true, value: realLocation});
  });

  it('should render children when there is no error', () => {
    render(
      <ErrorBoundary>
        <div>Child content</div>
      </ErrorBoundary>,
    );

    expect(screen.getByText('Child content')).toBeInTheDocument();
  });

  it('should render error UI when child throws', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Test error message')).toBeInTheDocument();
  });

  it('should render custom fallback when provided', () => {
    render(
      <ErrorBoundary fallback={<div>Custom error fallback</div>}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Custom error fallback')).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
  });

  it('reports the error through loadSentry, which loads Sentry if it has not yet (#640)', async () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(loadSentry).toHaveBeenCalled();
    await waitFor(() =>
      expect(captureException).toHaveBeenCalledWith(
        expect.objectContaining({message: 'Test error message'}),
        {contexts: {react: {componentStack: expect.any(String)}}},
      ),
    );
  });

  it('should call setState when Try Again is clicked', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    // Click try again - this will reset the error state and attempt to render children
    // Since ThrowError still throws, it will catch the error again
    // But we can verify the button is clickable and triggers a re-render attempt
    const tryAgainButton = screen.getByRole('button', {name: /try again/i});
    expect(tryAgainButton).toBeEnabled();

    // Clicking resets state, which re-renders children, which throws again
    fireEvent.click(tryAgainButton);

    // Error should be caught again
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('offers a reload instead of Try Again when a page could not load', () => {
    const reload = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {...realLocation, reload},
    });
    render(
      <ErrorBoundary>
        <FailToLoad />
      </ErrorBoundary>,
    );

    expect(screen.getByText("This page couldn't load")).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: 'Reload'}));
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
