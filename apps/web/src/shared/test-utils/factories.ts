import type {
  LorcanaCard,
  SynergyGroup,
  SynergyMatchDisplay,
  PairSynergyConnection,
  DetailedPairSynergy,
} from 'inkweave-synergy-engine';

/** Create a mock LorcanaCard with sensible defaults. */
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

/** Create a mock SynergyMatchDisplay (a card + score inside a group). */
export function createSynergyMatch(
  overrides: Partial<SynergyMatchDisplay> & {card?: Partial<LorcanaCard>} = {},
): SynergyMatchDisplay {
  const {card: cardOverrides, ...rest} = overrides;
  return {
    card: createCard(cardOverrides),
    score: 7,
    explanation: 'Test synergy',
    ...rest,
  };
}

/** Create a mock SynergyGroup with sensible defaults. */
export function createSynergyGroup(
  overrides: Partial<SynergyGroup> & {matchCount?: number} = {},
): SynergyGroup {
  const {matchCount, ...rest} = overrides;
  return {
    groupKey: 'shift-targets',
    category: 'direct',
    label: 'Shift Targets',
    description: 'Characters with Shift and their same-named targets',
    synergies: Array.from({length: matchCount ?? 1}, (_, i) =>
      createSynergyMatch({card: {id: `match-${i}`}}),
    ),
    ...rest,
  };
}

/** Create a mock PairSynergyConnection (direct category). */
export function createConnection(
  overrides: Partial<PairSynergyConnection> = {},
): PairSynergyConnection {
  return {
    ruleId: 'shift-targets',
    ruleName: 'Shift Targets',
    category: 'direct' as const,
    score: 8,
    explanation: 'Shift synergy',
    ...overrides,
  } as PairSynergyConnection;
}

/** Create a mock DetailedPairSynergy. */
export function createPairSynergy(
  overrides: Partial<DetailedPairSynergy> = {},
): DetailedPairSynergy {
  return {
    cardA: createCard({id: 'card-a', name: 'Card A', fullName: 'Card A - Version'}),
    cardB: createCard({id: 'card-b', name: 'Card B', fullName: 'Card B - Version'}),
    connections: [createConnection()],
    aggregateScore: 8,
    ...overrides,
  };
}
