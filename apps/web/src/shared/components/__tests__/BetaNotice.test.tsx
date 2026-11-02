import {afterEach, describe, expect, it, vi} from 'vitest';
import {render, screen} from '@testing-library/react';
import {BetaNotice, DISCORD_INVITE_URL} from '../BetaNotice';

// The flag is a module constant, so the mock serves it through a getter each case sets.
const flags = vi.hoisted(() => ({collection: true}));
vi.mock('../../../features/collection/flag', () => ({
  get SHOW_COLLECTION() {
    return flags.collection;
  },
}));

afterEach(() => {
  flags.collection = true;
});

describe('BetaNotice', () => {
  it('says the collection is in beta while collection mode is on', () => {
    render(<BetaNotice />);
    expect(screen.getByText('Collection is in beta')).toBeInTheDocument();
  });

  it('says Inkweave is in beta in a build without collection mode', () => {
    flags.collection = false;
    render(<BetaNotice />);
    expect(screen.getByText('Inkweave is in beta')).toBeInTheDocument();
    expect(screen.queryByText(/Collection/)).not.toBeInTheDocument();
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

  it('is a landmark named for screen readers', () => {
    render(<BetaNotice />);
    expect(screen.getByRole('complementary', {name: 'Beta notice'})).toBeInTheDocument();
  });
});
