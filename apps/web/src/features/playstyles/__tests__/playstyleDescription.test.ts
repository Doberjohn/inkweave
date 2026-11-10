import {describe, it, expect} from 'vitest';
import {playstyleDescription} from '../playstyleDescription';
import {getAllPlaystyles} from '../../synergies/engineCatalog';

describe('playstyleDescription', () => {
  it('fits every playstyle in 160 characters, naming it and Disney Lorcana', () => {
    for (const playstyle of getAllPlaystyles()) {
      const description = playstyleDescription(playstyle);
      expect(description.length, playstyle.id).toBeLessThanOrEqual(160);
      expect(description, playstyle.id).toContain(playstyle.name);
      expect(description, playstyle.id).toContain('Disney Lorcana');
    }
  });

  it('keeps the full wording when it fits', () => {
    expect(playstyleDescription({name: 'Ramp', tagline: 'Ink faster.'})).toBe(
      'Ink faster. Explore the cards, enablers, and payoffs that define the Ramp archetype in Disney Lorcana Core format.',
    );
  });
});
