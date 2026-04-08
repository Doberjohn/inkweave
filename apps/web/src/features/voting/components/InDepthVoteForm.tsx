import {useState} from 'react';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import type {Accuracy, Score} from '../../../shared/lib/supabase';
import type {InDepthFormState} from '../types';
import type {OptionColor} from './OptionPicker';
import {OptionPicker} from './OptionPicker';
import {ScorePicker} from './ScorePicker';
import {CarriesPicker} from './CarriesPicker';
import {COLORS, FONTS, FONT_SIZES, RADIUS, SPACING} from '../../../shared/constants';

export type FormLayout = 'stacked' | 'tabbed';

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
  animate?: boolean;
  layout?: FormLayout;
  /** Force compact pickers (stacked vertical buttons) regardless of isMobile */
  compact?: boolean;
}

// ── Group accent colors ──

const GROUP_ACCENTS = {
  assessment: '#60b5f5',
  rating: '#fbbf24',
  practical: '#6ee7a0',
} as const;

// ── Dimension color schemes ──

function makeColor(hex: string): OptionColor {
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

function CategoryHeader({stepRange, label, accent, compact}: {stepRange: string; label: string; accent: string; compact?: boolean}) {
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: SPACING.sm, marginBottom: compact ? SPACING.xs : SPACING.md}}>
      <span
        style={{
          fontSize: FONT_SIZES.xs,
          fontWeight: 700,
          color: accent,
          background: `${accent}1a`,
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

// ── Tab bar for tabbed layout ──

const TAB_GROUPS = [
  {key: 'assessment', label: 'Assessment', accent: GROUP_ACCENTS.assessment, stepRange: '1-2'},
  {key: 'rating', label: 'Rating', accent: GROUP_ACCENTS.rating, stepRange: '3-4'},
  {key: 'practical', label: 'Practical', accent: GROUP_ACCENTS.practical, stepRange: '5-6'},
] as const;

type TabKey = typeof TAB_GROUPS[number]['key'];

function TabBar({activeTab, onTabChange, answeredByGroup}: {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  answeredByGroup: Record<TabKey, number>;
}) {
  return (
    <div
      role="tablist"
      aria-label="Vote dimension groups"
      style={{
        display: 'flex',
        gap: SPACING.xs,
        width: '100%',
        marginBottom: SPACING.lg,
      }}>
      {TAB_GROUPS.map(({key, label, accent}) => {
        const isActive = activeTab === key;
        const groupAnswered = answeredByGroup[key];
        const groupTotal = 2;
        return (
          <button
            key={key}
            role="tab"
            aria-selected={isActive}
            aria-controls={`panel-${key}`}
            onClick={() => onTabChange(key)}
            style={{
              flex: 1,
              minHeight: 44,
              borderRadius: RADIUS.lg,
              border: isActive ? `2px solid ${accent}` : '1px solid rgba(255,255,255,0.08)',
              background: isActive ? `${accent}0f` : 'rgba(255,255,255,0.02)',
              color: isActive ? accent : COLORS.textMuted,
              fontSize: FONT_SIZES.base,
              fontWeight: isActive ? 700 : 500,
              fontFamily: FONTS.body,
              cursor: 'pointer',
              padding: '8px 4px',
              transition: 'all 0.2s ease',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
            }}>
            <span>{label}</span>
            <span style={{fontSize: FONT_SIZES.xs, opacity: 0.7}}>
              {groupAnswered === groupTotal ? '\u2713' : `${groupAnswered}/${groupTotal}`}
            </span>
          </button>
        );
      })}
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
  layout = 'stacked',
  compact,
}: InDepthVoteFormProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('assessment');
  const baseDelay = animate ? 200 : 0;
  const useCompact = compact || isMobile;

  const answeredByGroup: Record<TabKey, number> = {
    assessment: (formState.isReal !== null ? 1 : 0) + (formState.accuracy !== null ? 1 : 0),
    rating: (formState.score !== null ? 1 : 0) + (formState.whoCarries !== null ? 1 : 0),
    practical: (formState.wouldPlay !== null ? 1 : 0) + (formState.difficulty !== null ? 1 : 0),
  };

  // ── Group content builders ──

  const groupA = (delay: number) => (
    <>
      <CategoryHeader stepRange="1-2" label="Assessment" accent={GROUP_ACCENTS.assessment} compact={useCompact} />
      <DimensionSection label="Is this synergy real?" stepNumber={1} accentColor={GROUP_ACCENTS.assessment} isAnswered={formState.isReal !== null} animationDelay={delay} animate={animate}>
        <OptionPicker ariaLabel="Is this synergy real" options={IS_REAL_OPTIONS} value={formState.isReal} onChange={onSetIsReal} isMobile={useCompact} colorScheme={IS_REAL_COLORS} />
      </DimensionSection>
      <DimensionSection label="Is our score accurate?" stepNumber={2} accentColor={GROUP_ACCENTS.assessment} isAnswered={formState.accuracy !== null} animationDelay={delay + 60} animate={animate}>
        <OptionPicker ariaLabel="Is our score accurate" options={ACCURACY_OPTIONS} value={formState.accuracy} onChange={onSetAccuracy} isMobile={useCompact} colorScheme={ACCURACY_COLORS} />
      </DimensionSection>
    </>
  );

  const groupB = (delay: number) => (
    <>
      <CategoryHeader stepRange="3-4" label="Rating" accent={GROUP_ACCENTS.rating} compact={useCompact} />
      <DimensionSection label="Rate this synergy" stepNumber={3} accentColor={GROUP_ACCENTS.rating} isAnswered={formState.score !== null} animationDelay={delay} animate={animate}>
        <ScorePicker value={formState.score} onChange={onSetScore} isMobile={useCompact} />
      </DimensionSection>
      <DimensionSection label="Which card carries it?" stepNumber={4} accentColor={GROUP_ACCENTS.rating} isAnswered={formState.whoCarries !== null} animationDelay={delay + 60} animate={animate}>
        <CarriesPicker cardA={cardA} cardB={cardB} value={formState.whoCarries} onChange={onSetWhoCarries} isMobile={useCompact} />
      </DimensionSection>
    </>
  );

  const groupC = (delay: number) => (
    <>
      <CategoryHeader stepRange="5-6" label="Practical" accent={GROUP_ACCENTS.practical} compact={useCompact} />
      <DimensionSection label="Would you play these together?" stepNumber={5} accentColor={GROUP_ACCENTS.practical} isAnswered={formState.wouldPlay !== null} animationDelay={delay} animate={animate}>
        <OptionPicker ariaLabel="Would you play these together" options={WOULD_PLAY_OPTIONS} value={formState.wouldPlay} onChange={onSetWouldPlay} isMobile={useCompact} colorScheme={WOULD_PLAY_COLORS} />
      </DimensionSection>
      <DimensionSection label="How easy to pull off?" stepNumber={6} accentColor={GROUP_ACCENTS.practical} isAnswered={formState.difficulty !== null} animationDelay={delay + 60} animate={animate}>
        <OptionPicker ariaLabel="How easy to pull off" options={DIFFICULTY_OPTIONS} value={formState.difficulty} onChange={onSetDifficulty} isMobile={useCompact} colorScheme={DIFFICULTY_COLORS} />
      </DimensionSection>
    </>
  );

  // ── Layout: Stacked ──
  if (layout === 'stacked') {
    return (
      <div style={{display: 'flex', flexDirection: 'column', gap: SPACING.md, width: '100%'}}>
        {groupA(baseDelay)}
        <GroupSeparator />
        {groupB(baseDelay + 120)}
        <GroupSeparator />
        {groupC(baseDelay + 240)}
      </div>
    );
  }

  // ── Layout: Tabbed ──
  return (
    <div style={{width: '100%'}}>
      <TabBar activeTab={activeTab} onTabChange={setActiveTab} answeredByGroup={answeredByGroup} />

      <div role="tabpanel" id={`panel-${activeTab}`} aria-label={`${activeTab} questions`}>
        <div style={{display: 'flex', flexDirection: 'column', gap: SPACING.md}}>
          {activeTab === 'assessment' && groupA(0)}
          {activeTab === 'rating' && groupB(0)}
          {activeTab === 'practical' && groupC(0)}
        </div>
      </div>

      {/* Tab navigation buttons */}
      <div style={{display: 'flex', justifyContent: 'space-between', marginTop: SPACING.lg}}>
        <button
          onClick={() => setActiveTab(activeTab === 'rating' ? 'assessment' : 'rating')}
          disabled={activeTab === 'assessment'}
          style={{
            background: 'none',
            border: `1px solid ${activeTab === 'assessment' ? COLORS.surfaceBorder : COLORS.primary}33`,
            borderRadius: RADIUS.lg,
            color: activeTab === 'assessment' ? COLORS.textDim : COLORS.textMuted,
            fontSize: FONT_SIZES.base,
            fontFamily: FONTS.body,
            padding: '8px 20px',
            cursor: activeTab === 'assessment' ? 'default' : 'pointer',
            opacity: activeTab === 'assessment' ? 0.4 : 1,
            transition: 'all 0.2s',
          }}>
          &larr; Previous
        </button>
        <button
          onClick={() => setActiveTab(activeTab === 'assessment' ? 'rating' : 'practical')}
          disabled={activeTab === 'practical'}
          style={{
            background: 'none',
            border: `1px solid ${activeTab === 'practical' ? COLORS.surfaceBorder : COLORS.primary}33`,
            borderRadius: RADIUS.lg,
            color: activeTab === 'practical' ? COLORS.textDim : COLORS.textMuted,
            fontSize: FONT_SIZES.base,
            fontFamily: FONTS.body,
            padding: '8px 20px',
            cursor: activeTab === 'practical' ? 'default' : 'pointer',
            opacity: activeTab === 'practical' ? 0.4 : 1,
            transition: 'all 0.2s',
          }}>
          Next &rarr;
        </button>
      </div>
    </div>
  );
}
