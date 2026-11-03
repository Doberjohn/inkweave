import {afterEach, describe, expect, it, vi} from 'vitest';
import {fireEvent, render, screen} from '@testing-library/react';
import {trackEvent} from '../../lib/analytics';
import {BetaNotice, DISCORD_INVITE_URL} from '../BetaNotice';

vi.mock('../../lib/analytics', () => ({trackEvent: vi.fn()}));

afterEach(() => {
  vi.mocked(trackEvent).mockClear();
});

describe('BetaNotice', () => {
  it('says the collection is in beta', () => {
    render(<BetaNotice />);
    expect(screen.getByText('Collection is in beta')).toBeInTheDocument();
  });

  it('thanks the people testing and asks for their bugs and ideas', () => {
    render(<BetaNotice />);
    expect(
      screen.getByText('Thanks for testing! Found a bug or have an idea? Tell us on Discord.'),
    ).toBeInTheDocument();
  });

  it("opens the Discord server's invite in a new tab, telling it nothing about the page", () => {
    render(<BetaNotice />);
    const link = screen.getByRole('link', {name: 'Join our Discord'});
    expect(DISCORD_INVITE_URL).toBe('https://discord.gg/gvA6qUUPE');
    expect(link).toHaveAttribute('href', DISCORD_INVITE_URL);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('counts each press of the invite, saying only where the link sits', () => {
    render(<BetaNotice />);
    const link = screen.getByRole('link', {name: 'Join our Discord'});
    // A click on a link with target _blank opens nothing in jsdom, so the page stays.
    fireEvent.click(link);
    expect(trackEvent).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith('discord_invite_clicked', {surface: 'beta_notice'});
    fireEvent.click(link);
    expect(trackEvent).toHaveBeenCalledTimes(2);
  });

  it('sends nothing until the invite is pressed', () => {
    render(<BetaNotice />);
    expect(trackEvent).not.toHaveBeenCalled();
  });

  it('is a landmark named for screen readers', () => {
    render(<BetaNotice />);
    expect(screen.getByRole('complementary', {name: 'Beta notice'})).toBeInTheDocument();
  });
});
