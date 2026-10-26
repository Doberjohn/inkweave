import type {LorcanaCard} from 'inkweave-synergy-engine';

/** A card for a test, with the app factory's defaults: an inkable, cost-3 Amber Character. */
export function createCard(overrides: Partial<LorcanaCard> = {}): LorcanaCard {
  return {
    id: 'test-1',
    name: 'Test Card',
    fullName: 'Test Card - Version',
    cost: 3,
    ink: 'Amber',
    inkwell: true,
    type: 'Character',
    ...overrides,
  };
}
