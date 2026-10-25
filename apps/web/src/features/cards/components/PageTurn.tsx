import {useEffectEvent, useLayoutEffect, useRef, type ReactNode, type RefObject} from 'react';
import {poseLeaf, type Side, type TurnPage, type TurnPlan} from './pageTurnMath';

/**
 * The page turn (owner, 2026-10-24, #942): a sheet lifts off one page, swings over the rings and
 * lands on the other, with a shade crossing it on edge. The binder's view has already changed
 * when it starts (or, while a page is held, has yet to), so this draws copies over the real
 * pages: the sheet, its front the page it lifts and its back the page it lands as, and a flat
 * page where the picture under the sheet differs from the binder's (`turnPlan`). Decoration only:
 * hidden from assistive tech and out of the Tab order, and no press reaches it (`binder.css`).
 */

/** The page turn's time: a narrative timing, so a named const and not a `DURATION` step. */
export const TURN_MS = 700;
/** How far the eye sits from the binder, in px: the check-in page's, deep enough not to warp the sheet. */
const PERSPECTIVE = 2600;
/** A turn whose `transitionend` never comes, in a hidden tab say, still ends this long after. */
const END_SLACK_MS = 150;

/**
 * Lays a copy over a real page's box, measured to the fraction of a pixel: the board's height is
 * fractional, and a copy a rounded `offsetHeight` tall draws its cards a fraction off the real ones.
 */
function placeOver(copy: HTMLElement, page: HTMLElement) {
  const layer = copy.parentElement!.getBoundingClientRect();
  const box = page.getBoundingClientRect();
  copy.style.left = `${box.left - layer.left}px`;
  copy.style.top = `${box.top - layer.top}px`;
  copy.style.width = `${box.width}px`;
  copy.style.height = `${box.height}px`;
}

/** The line the sheet swings about: the spine's middle, beside the page it lifts. */
const originFor = (lifts: Side, spine: number) =>
  lifts === 'right' ? `${-spine / 2}px 50%` : `calc(100% + ${spine / 2}px) 50%`;

/** The real pages a turn lines up with: a spread's two, a phone's one. */
type Pages = {left?: RefObject<HTMLDivElement | null>; right: RefObject<HTMLDivElement | null>};

const pageOn = (pages: Pages, side: Side) => (side === 'left' ? pages.left?.current : pages.right.current);

/**
 * Lays the sheet and the flat page over the real pages they cover and poses the sheet at `at`
 * (0 where unset). Returns the sheet once placed, or null while the pages aren't there to cover.
 */
function layOut(
  {sheet, flat}: {sheet: HTMLElement | null; flat: HTMLElement | null},
  {plan, pages, spine, at}: Pick<PageTurnProps, 'plan' | 'pages' | 'spine' | 'at'>,
): HTMLElement | null {
  const lifted = pageOn(pages, plan.lifts);
  if (!sheet || !lifted) return null;
  placeOver(sheet, lifted);
  const under = plan.flat && pageOn(pages, plan.flat.side);
  if (flat && under) placeOver(flat, under);
  sheet.style.transformOrigin = originFor(plan.lifts, spine);
  poseLeaf(sheet, plan, typeof at === 'function' ? at() : (at ?? 0));
  return sheet;
}

/** Swings the sheet from its pose to its end, calling `onLand` once it lands. Returns the cleanup. */
function swing(leaf: HTMLElement, plan: TurnPlan, onLand: () => void): () => void {
  // Laid out at its pose first, so the transition runs from there.
  leaf.getBoundingClientRect();
  leaf.style.setProperty('--binder-turn-ms', `${TURN_MS}ms`);
  leaf.classList.add('binder-leaf-turning');
  poseLeaf(leaf, plan, 1);
  let landed = false;
  const land = () => {
    if (!landed) onLand();
    landed = true;
  };
  const onEnd = (e: TransitionEvent) => {
    if (e.target === leaf && e.propertyName === 'transform') land();
  };
  leaf.addEventListener('transitionend', onEnd);
  const timer = setTimeout(land, TURN_MS + END_SLACK_MS);
  return () => {
    leaf.removeEventListener('transitionend', onEnd);
    clearTimeout(timer);
  };
}

interface PageTurnProps {
  plan: TurnPlan;
  /** A page copy for the turn: `BinderSpread` passes its `BinderPage`, every slot with `tabIndex` -1. */
  renderPage: (page: TurnPage) => ReactNode;
  /** The real pages it lines up with: a spread's two, a phone's one. */
  pages: Pages;
  /** The spine's width: the sheet swings about its middle. */
  spine: number;
  /**
   * Held still at this pose, 0 to 1: the stories', or the grab's, read as the sheet is laid out,
   * from which the grab poses it itself (`poseLeaf`). Left out, it turns.
   */
  at?: number | (() => number);
  onDone?: () => void;
}

/**
 * The turning sheet over the real pages. Placed in a layout effect, so its first painted frame is
 * already in place; a turn that replaces it mounts a new one (`BinderSpread` keys it).
 */
export function PageTurn({plan, renderPage, pages: {left, right}, spine, at, onDone}: PageTurnProps) {
  const leaf = useRef<HTMLDivElement>(null);
  const flatRef = useRef<HTMLDivElement>(null);
  const done = useEffectEvent(() => onDone?.());
  useLayoutEffect(() => {
    const sheet = layOut({sheet: leaf.current, flat: flatRef.current}, {plan, pages: {left, right}, spine, at});
    if (sheet && at === undefined) return swing(sheet, plan, () => done());
  }, [plan, at, left, right, spine]);
  return (
    <div className="binder-turn" aria-hidden="true" inert style={{perspective: PERSPECTIVE}}>
      {plan.flat && (
        <div ref={flatRef} className="binder-turn-flat">
          {renderPage(plan.flat)}
        </div>
      )}
      <div ref={leaf} className="binder-leaf">
        <div className="binder-leaf-face">{renderPage(plan.front)}</div>
        {plan.back && <div className="binder-leaf-face binder-leaf-back">{renderPage(plan.back)}</div>}
      </div>
    </div>
  );
}
