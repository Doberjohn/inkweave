import type {LorcanaCard} from 'inkweave-synergy-engine';
import type {Accuracy, Score} from '../../../shared/lib/supabase';
import type {InDepthFormState} from '../types';
import {OptionPicker} from './OptionPicker';
import {ScorePicker} from './ScorePicker';
import {CarriesPicker} from './CarriesPicker';
import {COLORS, FONTS, FONT_SIZES, SPACING} from '../../../shared/constants';

interface InDepthVoteFormProps {
  formState: InDepthFormState;
  cardA: LorcanaCard;
  cardB: LorcanaCard;
  onSetIsReal: (value: boolean | null) => void;
  onSetAccuracy: (value: Accuracy) => void;
  onSetScore: (value: Score) => void;
  onSetWouldPlay: (value: boolean | null) => void;
  onSetWhoCarries: (value: 'a' | 'b' | 'both') => void;
  onSetDifficulty: (value: 1 | 2 | 3) => void;
  isMobile?: boolean;
}

// TODO(human): Implement the DimensionSection wrapper component below.
// See the Learn by Doing request for guidance.
function DimensionSection({label, children}: {label: string; children: React.ReactNode}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: SPACING.sm,
      }}>
      <span
        style={{
          fontSize: FONT_SIZES.base,
          fontWeight: 600,
          color: COLORS.textMuted,
          fontFamily: FONTS.body,
        }}>
        {label}
      </span>
      {children}
    </div>
  );
}

const IS_REAL_OPTIONS = [
  {key: 'yes', label: 'Yes', value: true as boolean | null},
  {key: 'no', label: 'No', value: false as boolean | null},
  {key: 'unsure', label: 'Unsure', value: null as boolean | null},
];

const ACCURACY_OPTIONS = [
  {key: 'low', label: 'Too Low', value: -1 as Accuracy},
  {key: 'right', label: 'About Right', value: 0 as Accuracy},
  {key: 'high', label: 'Too High', value: 1 as Accuracy},
];

const WOULD_PLAY_OPTIONS = [
  {key: 'yes', label: 'Yes', value: true as boolean | null},
  {key: 'no', label: 'No', value: false as boolean | null},
  {key: 'already', label: 'Already do', value: true as boolean | null},
];

const DIFFICULTY_OPTIONS = [
  {key: 'easy', label: 'Easy', value: 1 as 1 | 2 | 3},
  {key: 'situational', label: 'Situational', value: 2 as 1 | 2 | 3},
  {key: 'hard', label: 'Hard', value: 3 as 1 | 2 | 3},
];

export function InDepthVoteForm({
  formState,
  cardA,
  cardB,
  onSetIsReal,
  onSetAccuracy,
  onSetScore,
  onSetWouldPlay,
  onSetWhoCarries,
  onSetDifficulty,
  isMobile,
}: InDepthVoteFormProps) {
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: SPACING.xl, width: '100%'}}>
      <DimensionSection label="Is this synergy real?">
        <OptionPicker
          ariaLabel="Is this synergy real"
          options={IS_REAL_OPTIONS}
          value={formState.isReal}
          onChange={onSetIsReal}
          isMobile={isMobile}
        />
      </DimensionSection>

      <DimensionSection label="Is our score accurate?">
        <OptionPicker
          ariaLabel="Is our score accurate"
          options={ACCURACY_OPTIONS}
          value={formState.accuracy}
          onChange={onSetAccuracy}
          isMobile={isMobile}
        />
      </DimensionSection>

      <DimensionSection label="Rate this synergy">
        <ScorePicker
          value={formState.score}
          onChange={onSetScore}
          isMobile={isMobile}
        />
      </DimensionSection>

      <DimensionSection label="Would you play these together?">
        <OptionPicker
          ariaLabel="Would you play these together"
          options={WOULD_PLAY_OPTIONS}
          value={formState.wouldPlay}
          onChange={onSetWouldPlay}
          isMobile={isMobile}
        />
      </DimensionSection>

      <DimensionSection label="Which card carries it?">
        <CarriesPicker
          cardA={cardA}
          cardB={cardB}
          value={formState.whoCarries}
          onChange={onSetWhoCarries}
          isMobile={isMobile}
        />
      </DimensionSection>

      <DimensionSection label="How easy to pull off?">
        <OptionPicker
          ariaLabel="How easy to pull off"
          options={DIFFICULTY_OPTIONS}
          value={formState.difficulty}
          onChange={onSetDifficulty}
          isMobile={isMobile}
        />
      </DimensionSection>
    </div>
  );
}
