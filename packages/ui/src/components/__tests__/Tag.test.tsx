import {describe, expect, it} from 'vitest';
import {render, screen} from '@testing-library/react';
import {COLORS} from '../../tokens/theme';
import {Tag} from '../Tag';

describe('Tag', () => {
  it('reads its text in the muted colour, says more on hover, and never shrinks or wraps in a row', () => {
    render(<Tag title="From previewCards.json">preview</Tag>);
    const tag = screen.getByText('preview');
    expect(tag).toHaveAttribute('title', 'From previewCards.json');
    expect(tag).toHaveStyle({color: COLORS.textMuted, flex: '0 0 auto', whiteSpace: 'nowrap'});
  });

  it('has no title unless given one', () => {
    render(<Tag>released</Tag>);
    expect(screen.getByText('released')).not.toHaveAttribute('title');
  });
});
