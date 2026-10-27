import {describe, expect, it} from 'vitest';
import {render, screen, within} from '@testing-library/react';
import {SPACING} from '../../tokens/theme';
import {Panel} from '../Panel';

describe('Panel', () => {
  it('is a region named by its h2 title, with the action in its header', () => {
    render(
      <Panel title="Rules to review" action={<a href="/calibration">Open calibration →</a>}>
        <p>Ramp</p>
      </Panel>,
    );
    const panel = screen.getByRole('region', {name: 'Rules to review'});
    expect(
      within(panel).getByRole('heading', {level: 2, name: 'Rules to review'}),
    ).toBeInTheDocument();
    expect(within(panel).getByRole('link', {name: 'Open calibration →'})).toHaveAttribute(
      'href',
      '/calibration',
    );
    expect(within(panel).getByText('Ramp')).toBeInTheDocument();
  });

  it('takes links in its title, and is still named by its text', () => {
    render(
      <Panel
        title={
          <>
            <a href="/cards/1">Sisu</a> × Raya
          </>
        }>
        <p>Votes</p>
      </Panel>,
    );
    const panel = screen.getByRole('region', {name: 'Sisu × Raya'});
    expect(within(panel).getByRole('heading', {level: 2, name: 'Sisu × Raya'})).toBeInTheDocument();
    expect(within(panel).getByRole('link', {name: 'Sisu'})).toHaveAttribute('href', '/cards/1');
  });

  it('has no heading and is no landmark without a title', () => {
    render(
      <Panel>
        <p>Body only</p>
      </Panel>,
    );
    expect(screen.getByText('Body only')).toBeInTheDocument();
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });

  it('draws no header row for an action that renders nothing, such as a false condition', () => {
    const {container} = render(
      <Panel action={false} padded={false}>
        <p>Body only</p>
      </Panel>,
    );
    expect(container.querySelector('section')?.children).toHaveLength(1);
  });

  it('lets its title take focus from script, but never from Tab, when asked', () => {
    const {rerender} = render(
      <Panel title="Engine view">
        <p>Body</p>
      </Panel>,
    );
    expect(screen.getByRole('heading', {name: 'Engine view'})).not.toHaveAttribute('tabindex');

    rerender(
      <Panel title="Engine view" titleFocusable>
        <p>Body</p>
      </Panel>,
    );
    const heading = screen.getByRole('heading', {name: 'Engine view'});
    expect(heading).toHaveAttribute('tabindex', '-1');
    heading.focus();
    expect(heading).toHaveFocus();
  });

  it('pads its body unless told not to, for flush tables', () => {
    const {rerender} = render(
      <Panel title="Vote log">
        <table />
      </Panel>,
    );
    expect(screen.getByRole('region', {name: 'Vote log'})).toHaveStyle({
      padding: `${SPACING.xl}px`,
    });
    expect(screen.getByRole('region', {name: 'Vote log'})).toHaveStyle({
      backgroundClip: 'padding-box',
    });

    rerender(
      <Panel title="Vote log" padded={false}>
        <table />
      </Panel>,
    );
    expect(screen.getByRole('region', {name: 'Vote log'})).toHaveStyle({padding: '0px'});
  });
});
