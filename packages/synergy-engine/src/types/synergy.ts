import type {LorcanaCard} from './card.js';
import type {SynergyCategory, PlaystyleId} from './playstyle.js';

// Common fields shared by all synergy rules
interface SynergyRuleBase {
  id: string;
  name: string;
  description: string;

  // Does this rule apply to this card?
  matches: (card: LorcanaCard) => boolean;

  // Given a matching card, find cards that synergize with it
  findSynergies: (card: LorcanaCard, allCards: LorcanaCard[]) => SynergyMatch[];
}

// A rule where the synergy comes from the specific pair of cards
export interface DirectSynergyRule extends SynergyRuleBase {
  category: 'direct';
}

// A rule where the synergy comes from density of cards sharing a playstyle
export interface PlaystyleSynergyRule extends SynergyRuleBase {
  category: 'playstyle';
  playstyleId: PlaystyleId;
}

// Discriminated union — category narrows whether playstyleId is present
export type SynergyRule = DirectSynergyRule | PlaystyleSynergyRule;

// Result from a synergy rule evaluation
export interface SynergyMatch {
  card: LorcanaCard;
  score: number;
  explanation: string;
  bidirectional?: boolean;
}

// Single synergy match for display
export interface SynergyMatchDisplay {
  card: LorcanaCard;
  score: number;
  explanation: string;
  ruleId?: string;
  ruleName?: string;
}

// Grouped synergies for display
export interface SynergyGroup {
  groupKey: string; // rule.id for direct, playstyleId for playstyle
  category: SynergyCategory;
  label: string; // rule.name for direct, playstyle.name for playstyle
  description: string; // rule.description for direct, playstyle.description for playstyle
  synergies: SynergyMatchDisplay[];
}
