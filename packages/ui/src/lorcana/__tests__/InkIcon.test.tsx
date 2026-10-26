import {render, screen} from '@testing-library/react';
import {describe, it, expect} from 'vitest';
import {InkIcon} from '../InkIcon';
import type {Ink} from 'inkweave-synergy-engine';
import {fileOf} from '../../test-utils/files';

const ALL_INKS: Ink[] = ['Amber', 'Amethyst', 'Emerald', 'Ruby', 'Sapphire', 'Steel'];

describe('InkIcon', () => {
  it('renders an img for each ink color', () => {
    const {container} = render(
      <div>
        {ALL_INKS.map((ink) => (
          <InkIcon key={ink} ink={ink} />
        ))}
      </div>,
    );
    const imgs = container.querySelectorAll('img');
    expect(imgs).toHaveLength(6);
  });

  it('draws each ink from its own file', () => {
    for (const ink of ALL_INKS) {
      const {container, unmount} = render(<InkIcon ink={ink} />);
      expect(fileOf(container.querySelector('img')?.getAttribute('src')), ink).toBe(
        `${ink.toLowerCase()}.svg`,
      );
      unmount();
    }
  });

  it('uses the specified size', () => {
    const {container} = render(<InkIcon ink="Ruby" size={32} />);
    const img = container.querySelector('img')!;
    expect(img).toHaveAttribute('width', '32');
    expect(img).toHaveAttribute('height', '32');
  });

  it('is decorative by default (aria-hidden)', () => {
    const {container} = render(<InkIcon ink="Sapphire" />);
    const img = container.querySelector('img')!;
    expect(img).toHaveAttribute('aria-hidden', 'true');
    expect(img).toHaveAttribute('alt', '');
  });

  it('exposes alt text when not decorative', () => {
    render(<InkIcon ink="Emerald" decorative={false} />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('alt', 'Emerald');
    expect(img).toHaveAttribute('aria-hidden', 'false');
  });
});
