import {describe, expect, it} from 'vitest';
import {render, screen} from '@testing-library/react';
import {Notice} from '../Notice';

describe('Notice', () => {
  it('shows an info message without interrupting a screen reader', () => {
    render(<Notice>No events tracked yet.</Notice>);
    expect(screen.getByText('No events tracked yet.')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('announces an error as an alert', () => {
    render(
      <Notice tone="error">Could not load Web Analytics (vercel-analytics.json: 404).</Notice>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Could not load Web Analytics (vercel-analytics.json: 404).',
    );
  });

  it('breaks a long unbroken word, such as an API path, so a narrow column never scrolls sideways', () => {
    render(
      <Notice tone="error">
        GitHub 401 on /repos/Doberjohn/inkweave/git/ref/heads/master: Bad credentials
      </Notice>,
    );
    expect(screen.getByRole('alert')).toHaveStyle({overflowWrap: 'anywhere'});
  });
});
