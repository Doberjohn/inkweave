import {describe, expect, it} from 'vitest';
import {render, screen} from '@testing-library/react';
import {FinishCount} from './FinishCount';

describe('FinishCount', () => {
  it('draws a normal count on the black and a foil count on brushed gold, as the copies stripe does', () => {
    render(
      <>
        <FinishCount finish="normal" count={4} />
        <FinishCount finish="foil" count={1} />
      </>,
    );
    expect(screen.getByText('4').style.backgroundImage).not.toContain('gradient');
    expect(screen.getByText('1').style.backgroundImage).toContain('linear-gradient');
  });

  it('draws none as a dash', () => {
    render(<FinishCount finish="foil" count={0} />);
    expect(screen.getByText('–').style.backgroundImage).not.toContain('gradient');
  });
});
