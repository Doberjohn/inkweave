import {render, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {InkwellIcon, type InkwellValue} from '../InkwellIcon';
import {fileOf} from '../../test-utils/files';

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
