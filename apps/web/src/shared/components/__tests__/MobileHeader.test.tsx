import {describe, it, expect} from 'vitest';
import {render, screen} from '@testing-library/react';
import {MobileHeader} from '../MobileHeader';

describe('MobileHeader', () => {
  it('should render the app title', () => {
    render(<MobileHeader />);

    expect(screen.getByRole('heading', {name: /lorcana synergy/i})).toBeInTheDocument();
  });
});
