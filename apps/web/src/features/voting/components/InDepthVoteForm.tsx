import {useState, useEffect, useRef, useMemo} from 'react';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import type {Accuracy, Score} from '../../../shared/lib/supabase';
import type {InDepthFormState} from '../types';
import type {OptionColor} from './OptionPicker';
import {OptionPicker} from './OptionPicker';
import {ScorePicker} from './ScorePicker';
import {CarriesPicker} from './CarriesPicker';
import {COLORS, EASING, FONTS, FONT_SIZES, RADIUS, SPACING} from '../../../shared/constants';
import {useBoop} from '../../../shared/hooks';

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
  compact?: boolean;
}

interface FormHandlers {
  onSetIsReal: (value: boolean | null) => void;
  onSetAccuracy: (value: Accuracy) => void;
  onSetScore: (value: Score) => void;
  onSetWouldPlay: (value: boolean | null) => void;
  onSetWhoCarries: (value: 'a' | 'b' | 'both') => void;
  onSetDifficulty: (value: 1 | 2 | 3) => void;
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

const IS_REAL_COLORS: Record<string, OptionColor> = {yes: GREEN, no: RED};
const ACCURACY_COLORS: Record<string, OptionColor> = {low: RED, right: GREEN, high: BLUE};
const WOULD_PLAY_COLORS: Record<string, OptionColor> = {yes: GREEN, no: RED};
const DIFFICULTY_COLORS: Record<string, OptionColor> = {easy: GREEN, situational: BLUE, hard: RED};

// ── Option definitions ──

const IS_REAL_OPTIONS = [
  {key: 'yes', label: 'Yes', value: true as boolean | null},
  {key: 'no', label: 'No', value: false as boolean | null},
];

const ACCURACY_OPTIONS = [
  {key: 'low', label: 'Should be lower', value: -1 as Accuracy},
  {key: 'right', label: 'Score is fair', value: 0 as Accuracy},
  {key: 'high', label: 'Should be higher', value: 1 as Accuracy},
];

const WOULD_PLAY_OPTIONS = [
  {key: 'yes', label: 'Yes', value: true as boolean | null},
  {key: 'no', label: 'No', value: false as boolean | null},
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
      <span style={{fontSize: FONT_SIZES.xs, fontWeight: 700, color: accent, background: `${accent}1a`, padding: '2px 8px', borderRadius: 10, fontFamily: FONTS.body}}>
        {stepRange}
      </span>
      <span style={{fontSize: FONT_SIZES.sm, color: COLORS.textDim, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: FONTS.body}}>
        {label}
      </span>
    </div>
  );
}

function GroupSeparator() {
  return (
    <div style={{height: 1, background: 'linear-gradient(90deg, transparent, #333355, transparent)', margin: `${SPACING.sm}px 0`}} />
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
        transition: `border-color 0.3s ${EASING.smooth}, box-shadow 0.3s ${EASING.smooth}`,
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
            transition: `all 0.3s ${EASING.bounce}`,
          }}>
          {isAnswered ? '✓' : stepNumber}
        </span>
        <span style={{fontSize: FONT_SIZES.base, fontWeight: 600, color: COLORS.text, fontFamily: FONTS.body, flex: 1}}>
          {label}
        </span>
      </div>
      {children}
    </div>
  );
}

// ── Tab metadata + style helpers ──

const TAB_GROUPS = [
  {key: 'assessment', label: 'Assessment', accent: GROUP_ACCENTS.assessment, stepRange: '1-2'},
  {key: 'rating', label: 'Rating', accent: GROUP_ACCENTS.rating, stepRange: '3-4'},
  {key: 'practical', label: 'Practical', accent: GROUP_ACCENTS.practical, stepRange: '5-6'},
] as const;

type TabKey = typeof TAB_GROUPS[number]['key'];
const TAB_ORDER: TabKey[] = ['assessment', 'rating', 'practical'];

interface TabStyleInput {
  isActive: boolean;
  isHovered: boolean;
  accent: string;
}

function getTabBorder({isActive, isHovered, accent}: TabStyleInput): string {
  if (isActive) return `2px solid ${accent}`;
  if (isHovered) return `1px solid ${accent}66`;
  return '1px solid rgba(255,255,255,0.08)';
}

function getTabBackground({isActive, isHovered, accent}: TabStyleInput): string {
  if (isActive) return `${accent}0f`;
  if (isHovered) return `${accent}08`;
  return 'rgba(255,255,255,0.02)';
}

function getTabColor({isActive, isHovered, accent}: TabStyleInput): string {
  if (isActive) return accent;
  if (isHovered) return COLORS.text;
  return COLORS.textMuted;
}

function getTabStyle(input: TabStyleInput): React.CSSProperties {
  return {
    flex: 1,
    minHeight: 44,
    borderRadius: RADIUS.lg,
    border: getTabBorder(input),
    background: getTabBackground(input),
    color: getTabColor(input),
    fontSize: FONT_SIZES.base,
    fontWeight: input.isActive ? 700 : 500,
    fontFamily: FONTS.body,
    cursor: 'pointer',
    padding: '8px 4px',
    transition: `all 0.25s ${EASING.snappy}`,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
    boxShadow: input.isHovered ? `0 0 12px ${input.accent}15` : 'none',
  };
}

function TabBar({activeTab, onTabChange, answeredByGroup}: {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  answeredByGroup: Record<TabKey, number>;
}) {
  const [hoveredTab, setHoveredTab] = useState<TabKey | null>(null);
  const groupTotal = 2;

  return (
    <div role="tablist" aria-label="Vote dimension groups" style={{display: 'flex', gap: SPACING.xs, width: '100%', marginBottom: SPACING.lg}}>
      {TAB_GROUPS.map(({key, label, accent}) => {
        const isActive = activeTab === key;
        const isHovered = hoveredTab === key && !isActive;
        const groupAnswered = answeredByGroup[key];
        return (
          <button
            key={key}
            role="tab"
            aria-selected={isActive}
            aria-controls={`panel-${key}`}
            onClick={() => onTabChange(key)}
            onMouseEnter={() => setHoveredTab(key)}
            onMouseLeave={() => setHoveredTab(null)}
            style={getTabStyle({isActive, isHovered, accent})}>
            <span>{label}</span>
            <span style={{fontSize: FONT_SIZES.xs, opacity: 0.7}}>
              {groupAnswered === groupTotal ? '✓' : `${groupAnswered}/${groupTotal}`}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ── Nav button + style helpers ──

interface NavStyleInput {
  hovered: boolean;
  disabled: boolean;
  boopStyle: React.CSSProperties;
}

function getNavBorder(disabled: boolean, hovered: boolean): string {
  if (disabled) return `1px solid ${COLORS.surfaceBorder}`;
  if (hovered) return '1px solid rgba(255,185,0,0.5)';
  return `1px solid ${COLORS.primary}33`;
}

function getNavColor(disabled: boolean, hovered: boolean): string {
  if (disabled) return COLORS.textDim;
  if (hovered) return COLORS.primary;
  return COLORS.textMuted;
}

function getNavStyle({hovered, disabled, boopStyle}: NavStyleInput): React.CSSProperties {
  const interactive = hovered && !disabled;
  return {
    ...(disabled ? {} : boopStyle),
    background: interactive ? 'rgba(255,185,0,0.05)' : 'none',
    border: getNavBorder(disabled, hovered),
    borderRadius: RADIUS.lg,
    color: getNavColor(disabled, hovered),
    fontSize: FONT_SIZES.base,
    fontFamily: FONTS.body,
    fontWeight: interactive ? 600 : 500,
    padding: '8px 20px',
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.4 : 1,
    boxShadow: interactive ? '0 0 10px rgba(255,185,0,0.1)' : 'none',
  };
}

function NavButton({label, disabled, onClick}: {label: string; disabled: boolean; onClick: () => void}) {
  const [hovered, setHovered] = useState(false);
  const boop = useBoop({scale: 1.05, rotation: label.includes('Next') ? 2 : -2, timing: 250});
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => { setHovered(true); if (!disabled) boop.trigger(); }}
      onMouseLeave={() => setHovered(false)}
      style={getNavStyle({hovered, disabled, boopStyle: boop.style})}>
      {label}
    </button>
  );
}

// ── Group config (kills groupA/B/C duplication) ──

interface SectionContext {
  formState: InDepthFormState;
  handlers: FormHandlers;
  cardA: LorcanaCard;
  cardB: LorcanaCard;
  useCompact: boolean;
}

interface SectionConfig {
  label: string;
  stepNumber: number;
  isAnswered: (s: InDepthFormState) => boolean;
  renderPicker: (ctx: SectionContext) => React.ReactNode;
}

const ASSESSMENT_SECTIONS: SectionConfig[] = [
  {
    label: 'Is this synergy real?',
    stepNumber: 1,
    isAnswered: (s) => s.isReal !== null,
    renderPicker: ({formState, handlers, useCompact}) => (
      <OptionPicker ariaLabel="Is this synergy real" options={IS_REAL_OPTIONS} value={formState.isReal} onChange={handlers.onSetIsReal} isMobile={useCompact} colorScheme={IS_REAL_COLORS} />
    ),
  },
  {
    label: 'Is Inkweave score accurate?',
    stepNumber: 2,
    isAnswered: (s) => s.accuracy !== null,
    renderPicker: ({formState, handlers, useCompact}) => (
      <OptionPicker ariaLabel="Is Inkweave score accurate" options={ACCURACY_OPTIONS} value={formState.accuracy} onChange={handlers.onSetAccuracy} isMobile={useCompact} colorScheme={ACCURACY_COLORS} />
    ),
  },
];

const RATING_SECTIONS: SectionConfig[] = [
  {
    label: 'Rate this synergy',
    stepNumber: 3,
    isAnswered: (s) => s.score !== null,
    renderPicker: ({formState, handlers, useCompact}) => (
      <ScorePicker value={formState.score} onChange={handlers.onSetScore} isMobile={useCompact} responsive={!useCompact} />
    ),
  },
  {
    label: 'Which card drives the synergy?',
    stepNumber: 4,
    isAnswered: (s) => s.whoCarries !== null,
    renderPicker: ({formState, handlers, useCompact, cardA, cardB}) => (
      <CarriesPicker cardA={cardA} cardB={cardB} value={formState.whoCarries} onChange={handlers.onSetWhoCarries} isMobile={useCompact} />
    ),
  },
];

const PRACTICAL_SECTIONS: SectionConfig[] = [
  {
    label: 'Would you play these together?',
    stepNumber: 5,
    isAnswered: (s) => s.wouldPlay !== null,
    renderPicker: ({formState, handlers, useCompact}) => (
      <OptionPicker ariaLabel="Would you play these together" options={WOULD_PLAY_OPTIONS} value={formState.wouldPlay} onChange={handlers.onSetWouldPlay} isMobile={useCompact} colorScheme={WOULD_PLAY_COLORS} />
    ),
  },
  {
    label: 'How easy to pull off?',
    stepNumber: 6,
    isAnswered: (s) => s.difficulty !== null,
    renderPicker: ({formState, handlers, useCompact}) => (
      <OptionPicker ariaLabel="How easy to pull off" options={DIFFICULTY_OPTIONS} value={formState.difficulty} onChange={handlers.onSetDifficulty} isMobile={useCompact} colorScheme={DIFFICULTY_COLORS} />
    ),
  },
];

const GROUP_SECTIONS: Record<TabKey, SectionConfig[]> = {
  assessment: ASSESSMENT_SECTIONS,
  rating: RATING_SECTIONS,
  practical: PRACTICAL_SECTIONS,
};

interface DimensionGroupProps {
  groupKey: TabKey;
  delay: number;
  showHeader: boolean;
  animate: boolean | undefined;
  ctx: SectionContext;
}

function DimensionGroup({groupKey, delay, showHeader, animate, ctx}: DimensionGroupProps) {
  const meta = TAB_GROUPS.find((g) => g.key === groupKey)!;
  const sections = GROUP_SECTIONS[groupKey];
  return (
    <>
      {showHeader && <CategoryHeader stepRange={meta.stepRange} label={meta.label} accent={meta.accent} compact={ctx.useCompact} />}
      {sections.map((section, idx) => (
        <DimensionSection
          key={section.stepNumber}
          label={section.label}
          stepNumber={section.stepNumber}
          accentColor={meta.accent}
          isAnswered={section.isAnswered(ctx.formState)}
          animationDelay={delay + idx * 60}
          animate={animate}>
          {section.renderPicker(ctx)}
        </DimensionSection>
      ))}
    </>
  );
}

// ── Auto-advance hook ──

function useTabAutoAdvance(answeredByGroup: Record<TabKey, number>, activeTab: TabKey, setActiveTab: (t: TabKey) => void): void {
  const prevAnsweredRef = useRef(answeredByGroup);
  useEffect(() => {
    const prev = prevAnsweredRef.current;
    prevAnsweredRef.current = answeredByGroup;
    if (answeredByGroup[activeTab] !== 2) return;
    if (prev[activeTab] >= 2) return;
    const currentIdx = TAB_ORDER.indexOf(activeTab);
    const nextTab = TAB_ORDER[currentIdx + 1];
    if (!nextTab) return;
    const timer = setTimeout(() => setActiveTab(nextTab), 400);
    return () => clearTimeout(timer);
  }, [answeredByGroup, activeTab, setActiveTab]);
}

// ── Main form ──

function buildAnsweredByGroup(formState: InDepthFormState): Record<TabKey, number> {
  return {
    assessment: (formState.isReal !== null ? 1 : 0) + (formState.accuracy !== null ? 1 : 0),
    rating: (formState.score !== null ? 1 : 0) + (formState.whoCarries !== null ? 1 : 0),
    practical: (formState.wouldPlay !== null ? 1 : 0) + (formState.difficulty !== null ? 1 : 0),
  };
}

function StackedLayout({ctx, animate, baseDelay}: {ctx: SectionContext; animate: boolean | undefined; baseDelay: number}) {
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: SPACING.md, width: '100%'}}>
      <DimensionGroup groupKey="assessment" delay={baseDelay} showHeader animate={animate} ctx={ctx} />
      <GroupSeparator />
      <DimensionGroup groupKey="rating" delay={baseDelay + 120} showHeader animate={animate} ctx={ctx} />
      <GroupSeparator />
      <DimensionGroup groupKey="practical" delay={baseDelay + 240} showHeader animate={animate} ctx={ctx} />
    </div>
  );
}

interface TabbedLayoutProps {
  ctx: SectionContext;
  animate: boolean | undefined;
  activeTab: TabKey;
  setActiveTab: (t: TabKey) => void;
  answeredByGroup: Record<TabKey, number>;
}

function TabbedLayout({ctx, animate, activeTab, setActiveTab, answeredByGroup}: TabbedLayoutProps) {
  return (
    <div style={{width: '100%'}}>
      <TabBar activeTab={activeTab} onTabChange={setActiveTab} answeredByGroup={answeredByGroup} />
      <div role="tabpanel" id={`panel-${activeTab}`} aria-label={`${activeTab} questions`}>
        <div style={{display: 'flex', flexDirection: 'column', gap: SPACING.md}}>
          <DimensionGroup groupKey={activeTab} delay={0} showHeader={false} animate={animate} ctx={ctx} />
        </div>
      </div>
      <div style={{display: 'flex', justifyContent: 'space-between', marginTop: SPACING.lg}}>
        <NavButton
          label="← Previous"
          disabled={activeTab === 'assessment'}
          onClick={() => setActiveTab(activeTab === 'rating' ? 'assessment' : 'rating')}
        />
        <NavButton
          label="Next →"
          disabled={activeTab === 'practical'}
          onClick={() => setActiveTab(activeTab === 'assessment' ? 'rating' : 'practical')}
        />
      </div>
    </div>
  );
}

export function InDepthVoteForm({
  formState, cardA, cardB,
  onSetIsReal, onSetAccuracy, onSetScore, onSetWouldPlay, onSetWhoCarries, onSetDifficulty,
  isMobile, animate, layout = 'stacked', compact,
}: InDepthVoteFormProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('assessment');
  const useCompact = Boolean(compact || isMobile);
  const handlers: FormHandlers = {onSetIsReal, onSetAccuracy, onSetScore, onSetWouldPlay, onSetWhoCarries, onSetDifficulty};
  const ctx: SectionContext = {formState, handlers, cardA, cardB, useCompact};

  const answeredByGroup = useMemo<Record<TabKey, number>>(
    () => buildAnsweredByGroup(formState),
    [formState],
  );

  useTabAutoAdvance(answeredByGroup, activeTab, setActiveTab);

  if (layout === 'stacked') {
    return <StackedLayout ctx={ctx} animate={animate} baseDelay={animate ? 200 : 0} />;
  }
  return <TabbedLayout ctx={ctx} animate={animate} activeTab={activeTab} setActiveTab={setActiveTab} answeredByGroup={answeredByGroup} />;
}
