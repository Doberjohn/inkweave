import {render, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {InkwellIcon, type InkwellValue} from '../InkwellIcon';

/** The file an asset url names, without its folder or query. */
const fileOf = (src: string | null | undefined) => src?.split('?')[0].split('/').pop();

describe('InkwellIcon', () => {
  it('draws each value from its own file', () => {
    for (const value of ['inkable', 'uninkable'] satisfies InkwellValue[]) {
      const {container, unmount} = render(<InkwellIcon value={value} />);
      expect(fileOf(container.querySelector('img')?.getAttribute('src')), value).toBe(
        `${value}.svg`,
      );
      unmount();
    }
  });

  it('names the value when it stands without a label', () => {
    render(<InkwellIcon value="uninkable" decorative={false} />);
    expect(screen.getByRole('img')).toHaveAttribute('alt', 'Uninkable');
  });
});
