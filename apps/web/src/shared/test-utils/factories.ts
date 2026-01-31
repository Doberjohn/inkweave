import type {LorcanaCard} from 'lorcana-synergy-engine';

/**
 * Factory function to create mock LorcanaCard objects for testing.
 * Provides sensible defaults that can be overridden.
 */
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
