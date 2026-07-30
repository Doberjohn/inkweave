import {describe, expect, it} from 'vitest';
import {render, screen} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {OffSeasonNotice} from './RevealsOffSeason';

const DATES = {
  prereleaseDate: new Date(2026, 6, 17),
  releaseDate: new Date(2026, 6, 24),
  name: 'Attack of the Vine!',
};

describe('OffSeasonNotice', () => {
  it('names the set and its release date once the set is out', () => {
    render(
      <MemoryRouter>
        <OffSeasonNotice phase="released" dates={DATES} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', {level: 1, name: 'Reveal season has ended'})).toBeInTheDocument();
    expect(screen.getByText(/Attack of the Vine! released on 24 July 2026\./)).toBeInTheDocument();
    expect(
      screen.getByText('The spoiler board is closed until the next set.'),
    ).toBeInTheDocument();
  });

  it('says only that there is no season when the feature is off', () => {
    render(
      <MemoryRouter>
        <OffSeasonNotice phase="hidden" dates={null} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', {level: 1, name: 'No reveal season right now'})).toBeInTheDocument();
    expect(screen.queryByText(/Attack of the Vine!/)).not.toBeInTheDocument();
    expect(
      screen.getByText('Until then, the full Core catalogue is a click away.'),
    ).toBeInTheDocument();
  });
});
