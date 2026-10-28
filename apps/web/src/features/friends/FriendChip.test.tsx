import {render, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {COLORS, INK_CHIP_COLORS} from '../../shared/constants';
import {FriendChip} from './FriendChip';
import {initialsOf, inkOfHandle} from './friendInitials';

describe('initialsOf', () => {
  it("takes the first letter of the name's first two words", () => {
    expect(initialsOf('Ruby Hero 042')).toBe('RH');
    expect(initialsOf('  sapphire   dragon 204 ')).toBe('SD');
    expect(initialsOf('Mickey')).toBe('M');
  });
});

describe('inkOfHandle', () => {
  it('reads the ink a handle starts with, whatever its case', () => {
    expect(inkOfHandle('ruby_hero_042')).toBe('Ruby');
    expect(inkOfHandle('Amethyst_Witch_9')).toBe('Amethyst');
    expect(inkOfHandle('mickey_fan')).toBeNull();
    expect(inkOfHandle(null)).toBeNull();
  });
});

describe('FriendChip', () => {
  it.each(Object.entries(INK_CHIP_COLORS))('draws a %s handle in its ink', (ink, colors) => {
    render(<FriendChip name="Some Player" handle={`${ink.toLowerCase()}_player_1`} />);
    expect(screen.getByText('SP')).toHaveStyle({backgroundColor: colors.bg, color: colors.text});
  });

  it('draws a handle with no ink on the neutral surface', () => {
    render(<FriendChip name="Mickey Fan" handle="mickey_fan" />);
    expect(screen.getByText('MF')).toHaveStyle({backgroundColor: COLORS.surfaceHover, color: COLORS.text});
  });
});
