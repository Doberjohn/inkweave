import {describe, it, expect} from 'vitest';
import {inkHubTrail} from '../breadcrumbs';

describe('inkHubTrail', () => {
  it('leads Home, Inks, then the ink at its hub', () => {
    expect(inkHubTrail('Amber')).toEqual([
      {name: 'Home', path: '/'},
      {name: 'Inks', path: '/inks'},
      {name: 'Amber', path: '/ink/amber'},
    ]);
  });
});
