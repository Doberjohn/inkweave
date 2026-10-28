import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it, vi} from 'vitest';
import {FriendBinderBanner, FriendNotSharing, type FriendBinderBannerProps} from './FriendBinderBanner';

const props = (overrides: Partial<FriendBinderBannerProps> = {}): FriendBinderBannerProps => ({
  isMobile: false,
  name: 'Ruby Hero 042',
  handle: 'ruby_hero_042',
  shown: true,
  youNeed: 33,
  back: 'yours',
  onBack: vi.fn(),
  ...overrides,
});

describe('FriendBinderBanner (#1045)', () => {
  it('names whose binder it is, with their handle, says it is read only, and goes back', async () => {
    const all = props();
    render(<FriendBinderBanner {...all} />);
    expect(screen.getByRole('heading', {name: "Ruby Hero 042's binder"})).toHaveClass('ph-no-capture');
    expect(screen.getByText('@ruby_hero_042')).toBeInTheDocument();
    expect(screen.getByText('Read only')).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', {name: /Back to your binder/}));
    expect(all.onBack).toHaveBeenCalledTimes(1);
  });

  it('names the binder by handle until the name is known, and claims nothing while it loads', () => {
    render(<FriendBinderBanner {...props({name: null, shown: false})} />);
    expect(screen.getByRole('heading', {name: "@ruby_hero_042's binder"})).toBeInTheDocument();
    expect(screen.queryByText('Read only')).toBeNull();
  });

  it('says on a phone how many of their cards you need, and goes back as Yours', () => {
    render(<FriendBinderBanner {...props({isMobile: true})} />);
    expect(screen.getByText('Read only · you need 33 of theirs')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: /Yours/})).toBeInTheDocument();
  });

  it('leaves the count out for a reader with no collection, who goes back to Browse', () => {
    render(<FriendBinderBanner {...props({isMobile: true, youNeed: null, back: 'browse'})} />);
    expect(screen.getByText('Read only')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: /Browse/})).toBeInTheDocument();
  });
});

describe('FriendNotSharing', () => {
  it('says the same for anyone who does not share, by name or by handle', () => {
    const {rerender} = render(<FriendNotSharing name="Ruby Hero 042" handle="ruby_hero_042" />);
    expect(screen.getByRole('status')).toHaveTextContent("Ruby Hero 042 doesn't share their collection with you.");
    rerender(<FriendNotSharing name={null} handle="nobody_here" />);
    expect(screen.getByRole('status')).toHaveTextContent("@nobody_here doesn't share their collection with you.");
  });
});
