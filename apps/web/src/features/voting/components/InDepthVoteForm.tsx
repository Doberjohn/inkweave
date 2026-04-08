import type {LorcanaCard} from 'inkweave-synergy-engine';
import type {Accuracy, Score} from '../../../shared/lib/supabase';
import type {InDepthFormState} from '../types';
import type {OptionColor} from './OptionPicker';
import {OptionPicker} from './OptionPicker';
import {ScorePicker} from './ScorePicker';
import {CarriesPicker} from './CarriesPicker';
import {COLORS, FONTS, FONT_SIZES, RADIUS, SPACING} from '../../../shared/constants';

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
  /** Whether to play entrance animations */
  animate?: boolean;
}

// ── Group accent colors ──

const GROUP_ACCENTS = {
  assessment: '#60b5f5',  // blue — analytical
  rating: '#fbbf24',      // gold — scoring
  practical: '#6ee7a0',   // green — gameplay
} as const;

// ── Dimension color schemes (semantic per-option colors) ──

function makeColor(hex: string): OptionColor {
  // Extract RGB from hex and build rgba variants
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return {
    border: hex,
    glow: `rgba(${r},${g},${b},0.15)`,
    hintBg: `rgba(${r},${g},${b},0.06)`,
    hoverBorder: `rgba(${r},${g},${b},0.35)`,
  };
}

const GREEN = makeColor('#6ee7a0');
const RED = makeColor('#f59090');
const BLUE = makeColor('#60b5f5');
const AMBER = makeColor('#d4af37');
const GOLD_BRIGHT = makeColor('#fbbf24');

const IS_REAL_COLORS: Record<string, OptionColor> = {yes: GREEN, no: RED, unsure: AMBER};
const ACCURACY_COLORS: Record<string, OptionColor> = {low: RED, right: GREEN, high: BLUE};
const WOULD_PLAY_COLORS: Record<string, OptionColor> = {yes: GREEN, no: RED, already: GOLD_BRIGHT};
const DIFFICULTY_COLORS: Record<string, OptionColor> = {easy: GREEN, situational: BLUE, hard: RED};

// ── Option definitions ──

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

// ── Sub-components ──

function CategoryHeader({stepRange, label, accent, isMobile}: {stepRange: string; label: string; accent: string; isMobile?: boolean}) {
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: SPACING.sm, marginBottom: isMobile ? SPACING.xs : SPACING.md}}>
      <span
        style={{
          fontSize: FONT_SIZES.xs,
          fontWeight: 700,
          color: accent,
          background: `${accent}1a`, // 10% opacity
          padding: '2px 8px',
          borderRadius: 10,
          fontFamily: FONTS.body,
        }}>
        {stepRange}
      </span>
      <span
        style={{
          fontSize: FONT_SIZES.sm,
          color: COLORS.textDim,
          fontWeight: 500,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          fontFamily: FONTS.body,
        }}>
        {label}
      </span>
    </div>
  );
}

function GroupSeparator() {
  return (
    <div
      style={{
        height: 1,
        background: 'linear-gradient(90deg, transparent, #333355, transparent)',
        margin: `${SPACING.sm}px 0`,
      }}
    />
  );
}

interface DimensionSectionProps {
  label: string;
  stepNumber: number;
  accentColor: string;
  isAnswered: boolean;
  animationDelay: number;
  animate?: boolean;
  children: React.ReactNode;
}

function DimensionSection({label, stepNumber, accentColor, isAnswered, animationDelay, animate, children}: DimensionSectionProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: SPACING.sm,
        padding: SPACING.lg,
        borderRadius: RADIUS.lg,
        borderLeft: `3px solid ${accentColor}`,
        background: 'rgba(255,255,255,0.02)',
        boxShadow: isAnswered ? `-4px 0 12px ${accentColor}26` : 'none',
        transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
        animation: animate ? `idv-fade-up 0.35s ease-out ${animationDelay}ms both` : 'none',
      }}>
      {/* Label row with step number and completion check */}
      <div style={{display: 'flex', alignItems: 'center', gap: SPACING.sm}}>
        <span
          style={{
            width: 18,
            height: 18,
            borderRadius: '50%',
            border: `1px solid ${accentColor}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: FONT_SIZES.xs,
            fontWeight: 700,
            color: isAnswered ? '#0d0d14' : accentColor,
            background: isAnswered ? accentColor : 'transparent',
            fontFamily: FONTS.body,
            flexShrink: 0,
            transition: 'all 0.3s ease',
          }}>
          {isAnswered ? '\u2713' : stepNumber}
        </span>
        <span
          style={{
            fontSize: FONT_SIZES.base,
            fontWeight: 600,
            color: COLORS.text,
            fontFamily: FONTS.body,
            flex: 1,
          }}>
          {label}
        </span>
      </div>
      {children}
    </div>
  );
}

// ── Main form ──

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
  animate,
}: InDepthVoteFormProps) {
  const baseDelay = animate ? 200 : 0; // Start after pair + progress bar

  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: SPACING.md, width: '100%'}}>

      {/* ── Group A: Assessment ── */}
      <CategoryHeader stepRange="1-2" label="Assessment" accent={GROUP_ACCENTS.assessment} isMobile={isMobile} />

      <DimensionSection label="Is this synergy real?" stepNumber={1} accentColor={GROUP_ACCENTS.assessment} isAnswered={formState.isReal !== null} animationDelay={baseDelay} animate={animate}>
        <OptionPicker
          ariaLabel="Is this synergy real"
          options={IS_REAL_OPTIONS}
          value={formState.isReal}
          onChange={onSetIsReal}
          isMobile={isMobile}
          colorScheme={IS_REAL_COLORS}
          animationDelayBase={animate ? baseDelay + 50 : 0}
        />
      </DimensionSection>

      <DimensionSection label="Is our score accurate?" stepNumber={2} accentColor={GROUP_ACCENTS.assessment} isAnswered={formState.accuracy !== null} animationDelay={baseDelay + 60} animate={animate}>
        <OptionPicker
          ariaLabel="Is our score accurate"
          options={ACCURACY_OPTIONS}
          value={formState.accuracy}
          onChange={onSetAccuracy}
          isMobile={isMobile}
          colorScheme={ACCURACY_COLORS}
          animationDelayBase={animate ? baseDelay + 110 : 0}
        />
      </DimensionSection>

      <GroupSeparator />

      {/* ── Group B: Rating ── */}
      <CategoryHeader stepRange="3-4" label="Rating" accent={GROUP_ACCENTS.rating} isMobile={isMobile} />

      <DimensionSection label="Rate this synergy" stepNumber={3} accentColor={GROUP_ACCENTS.rating} isAnswered={formState.score !== null} animationDelay={baseDelay + 120} animate={animate}>
        <ScorePicker
          value={formState.score}
          onChange={onSetScore}
          isMobile={isMobile}
        />
      </DimensionSection>

      <DimensionSection label="Which card carries it?" stepNumber={4} accentColor={GROUP_ACCENTS.rating} isAnswered={formState.whoCarries !== null} animationDelay={baseDelay + 180} animate={animate}>
        <CarriesPicker
          cardA={cardA}
          cardB={cardB}
          value={formState.whoCarries}
          onChange={onSetWhoCarries}
          isMobile={isMobile}
        />
      </DimensionSection>

      <GroupSeparator />

      {/* ── Group C: Practical ── */}
      <CategoryHeader stepRange="5-6" label="Practical" accent={GROUP_ACCENTS.practical} isMobile={isMobile} />

      <DimensionSection label="Would you play these together?" stepNumber={5} accentColor={GROUP_ACCENTS.practical} isAnswered={formState.wouldPlay !== null} animationDelay={baseDelay + 240} animate={animate}>
        <OptionPicker
          ariaLabel="Would you play these together"
          options={WOULD_PLAY_OPTIONS}
          value={formState.wouldPlay}
          onChange={onSetWouldPlay}
          isMobile={isMobile}
          colorScheme={WOULD_PLAY_COLORS}
          animationDelayBase={animate ? baseDelay + 290 : 0}
        />
      </DimensionSection>

      <DimensionSection label="How easy to pull off?" stepNumber={6} accentColor={GROUP_ACCENTS.practical} isAnswered={formState.difficulty !== null} animationDelay={baseDelay + 300} animate={animate}>
        <OptionPicker
          ariaLabel="How easy to pull off"
          options={DIFFICULTY_OPTIONS}
          value={formState.difficulty}
          onChange={onSetDifficulty}
          isMobile={isMobile}
          colorScheme={DIFFICULTY_COLORS}
          animationDelayBase={animate ? baseDelay + 350 : 0}
        />
      </DimensionSection>
    </div>
  );
}
