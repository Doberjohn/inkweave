import {describe, expect, it, vi} from 'vitest';
import {render, screen, fireEvent} from '@testing-library/react';
import {FullPageNotice} from '../FullPageNotice';

describe('FullPageNotice', () => {
  it('renders the title, both prose lines, and fires the CTA', () => {
    const onCta = vi.fn();
    render(
      <FullPageNotice
        title="Reveal season has ended"
        lines={['First line.', 'Second line.']}
        ctaLabel="Return to Inkweave"
        onCta={onCta}
      />,
    );
    expect(
      screen.getByRole('heading', {level: 2, name: 'Reveal season has ended'}),
    ).toBeInTheDocument();
    expect(screen.getByText('First line.')).toBeInTheDocument();
    expect(screen.getByText('Second line.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: /return to inkweave/i}));
    expect(onCta).toHaveBeenCalledOnce();
  });

  it('renders the hero slot only when one is given', () => {
    const {rerender} = render(
      <FullPageNotice title="T" lines={['a', 'b']} ctaLabel="Go" onCta={vi.fn()} />,
    );
    expect(screen.queryByTestId('notice-hero')).not.toBeInTheDocument();
    rerender(
      <FullPageNotice
        hero={<span data-testid="notice-hero">404</span>}
        title="T"
        lines={['a', 'b']}
        ctaLabel="Go"
        onCta={vi.fn()}
        titleLevel={1}
      />,
    );
    expect(screen.getByTestId('notice-hero')).toBeInTheDocument();
    expect(screen.getByRole('heading', {level: 1, name: 'T'})).toBeInTheDocument();
  });
});
