import type {Meta, StoryObj} from '@storybook/react-vite';
import {useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {MemoryRouter} from 'react-router-dom';
import {fn} from 'storybook/test';
import {BinderPage, BinderSpread, PER_PAGE} from './BinderSpread';
import {CardTile} from './CardTile';
import {BINDER_CARDS} from './binderStoryCards';
import {PageTurn} from './PageTurn';
import {turnPlan, type TurnPage} from './pageTurnMath';
import {COLORS, SPACING} from '../../../shared/constants';

/** Slot n's card: the story cards over and over, as a set of 204 cards runs. */
const slot = (index: number, tabIndex = -1) => (
  <CardTile
    card={BINDER_CARDS[index % BINDER_CARDS.length]}
    onSelect={fn()}
    variant="minimal"
    borderRadius={0}
    useSmallImage
    tabIndex={tabIndex}
  />
);

interface HeldTurnProps {
  /** The view the binder shows beneath: a page in hand hasn't turned it yet. */
  from: number;
  /** The view the page turns to. */
  to: number;
  /** How far over the page is: 0 where it lay, 1 landed. */
  at: number;
  /** A phone's lone page. */
  single?: boolean;
}

/**
 * A page held part way over, as grabbing it draws it (#942): the binder at `from` beneath, and in
 * its board the turn's sheet at `at`, with the flat page it uncovers. `BinderSpread` draws the
 * same sheet over the same pages; this lays it over a binder that holds still.
 */
function HeldTurn({from, to, at, single = false}: HeldTurnProps) {
  const host = useRef<HTMLDivElement>(null);
  const left = useRef<HTMLDivElement | null>(null);
  const right = useRef<HTMLDivElement | null>(null);
  const [board, setBoard] = useState<HTMLElement | null>(null);
  // A frame after the binder is laid out, sized to its box: its board takes the sheet, and its
  // pages line the sheet up.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const root = host.current;
      left.current = root?.querySelector<HTMLDivElement>('.binder-page-left') ?? null;
      right.current = root?.querySelector<HTMLDivElement>('.binder-page-right') ?? null;
      setBoard(root?.querySelector<HTMLElement>('.binder-board') ?? null);
    });
    return () => cancelAnimationFrame(frame);
  }, [from, single]);
  const copy = (page: TurnPage) => (
    <BinderPage
      from={page.from}
      side={page.side}
      single={single}
      renderSlot={slot}
      cover={!single && page.from < 0 ? 'front' : undefined}
    />
  );
  return (
    <div ref={host} style={{height: '100%'}}>
      <BinderSpread
        start={from}
        single={single}
        renderSlot={slot}
        cardCount={204}
        onPrev={fn()}
        onNext={fn()}
        canPrev={from > 0}
        canNext
      />
      {board &&
        createPortal(
          <PageTurn
            plan={turnPlan(from, to, {single, held: true, perPage: PER_PAGE})}
            renderPage={copy}
            pages={{left, right}}
            // The spine's width, as the binder draws it (`SPINE_WIDTH`).
            spine={SPACING.xxl}
            at={at}
          />,
          board,
        )}
    </div>
  );
}

/**
 * The page turn (owner, 2026-10-24, #942): a sheet lifts off one page, swings over the rings and
 * lands on the other, a shade crossing it on edge. Each story holds a page part way over, as
 * grabbing it does, over a binder that shows the view beneath. In the app every way of turning
 * draws it, and it turns in 0.7s (`TURN_MS`); here it holds still, to judge the sheet against the
 * pages under it. The story cards have no art (`binderStoryCards`).
 *
 * The sheet is decoration: hidden from assistive tech, out of the Tab order, and no press reaches it.
 */
const meta: Meta<typeof HeldTurn> = {
  title: 'Cards/PageTurn',
  component: HeldTurn,
  decorators: [
    (Story) => (
      <MemoryRouter>
        <div style={{height: 760, background: COLORS.background}}>
          <Story />
        </div>
      </MemoryRouter>
    ),
  ],
  parameters: {layout: 'fullscreen'},
  args: {from: 12, to: 36, at: 0.5},
};

export default meta;
type Story = StoryObj<typeof meta>;

/** Forward, a quarter over: the right page lifting off, the next spread's right page beneath it. */
export const ForwardAQuarter: Story = {args: {at: 0.25}};

/**
 * Forward, halfway: the sheet stands on edge over the rings, 90° from flat, and has no thickness to
 * show, so both pages beneath lie open: the spread it leaves on the left, the one it uncovers on
 * the right.
 */
export const ForwardHalfway: Story = {args: {at: 0.5}};

/** Forward, three quarters: past the rings, its back (the next spread's left page) coming down. */
export const ForwardThreeQuarters: Story = {args: {at: 0.75}};

/** Back, a third over: the left page lifts toward the right, the spread before's left page beneath it. */
export const BackAThird: Story = {args: {from: 36, to: 12, at: 0.35}};

/** Off the front cover: the first page of cards lifts beside the inside front cover. */
export const OffTheFrontCover: Story = {args: {from: -12, to: 12, at: 0.3}};

/** A phone's page swinging away to the left, halfway, the next page beneath. */
export const PhoneAway: Story = {
  args: {from: 0, to: 12, at: 0.5, single: true},
  globals: {viewport: {value: 'mobile1'}},
};

/** A phone's page before swinging back in over the lone page, halfway. */
export const PhoneBackIn: Story = {
  args: {from: 12, to: 0, at: 0.5, single: true},
  globals: {viewport: {value: 'mobile1'}},
};
