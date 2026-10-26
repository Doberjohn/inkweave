import {useState} from 'react';
import {turnPlan, type TurnPlan} from './pageTurnMath';

/** A turn of the binder's pages, from the view at `from` to the view at `to` (#942). */
export interface Turn {
  from: number;
  to: number;
  /** In the pointer's hand: the binder still shows `from` (see `turnPlan`). */
  held: boolean;
  plan: TurnPlan;
}

interface TurnOptions {
  single: boolean;
  perPage: number;
  /** Under reduced motion the view just changes. */
  reducedMotion: boolean;
}

/** The view the binder showed last, and how many pockets its pages held. */
interface Seen {
  start: number;
  single: boolean;
  perPage: number;
}

/** A change of view, as `turnsTo` weighs it. */
interface Change extends Pick<TurnOptions, 'single' | 'perPage' | 'reducedMotion'> {
  seen: Seen;
  /** The turn drawn as the view changed. */
  turn: Turn | null;
}

/** Whether the binder still draws the pages it drew: as wide, with as many pockets (#1000). */
function sameShape(seen: Seen, {single, perPage}: Pick<Seen, 'single' | 'perPage'>) {
  return single === seen.single && perPage === seen.perPage;
}

/**
 * Whether the view changing to `start` turns a page: not across the phone width, nor as a phone's
 * page gains or loses a row (#1000), nor under reduced motion, nor once a page in hand has landed
 * there, which has already shown its turn.
 */
function turnsTo(start: number, {seen, turn, single, perPage, reducedMotion}: Change) {
  const landed = turn?.held === true && turn.to === start;
  return sameShape(seen, {single, perPage}) && !reducedMotion && !landed;
}

/**
 * The page turn the binder draws, following its view (`start`), so every way the view changes
 * turns the page through this one place: the discs, the arrows beside a spread, a phone's row,
 * Enter on any of them, and the spread map. The view changes at once; the turn is drawn over it.
 *
 * A TURN THAT STARTS WHILE ONE RUNS REPLACES IT, so quick presses all land and never queue
 * behind one another (the #790 keyboard test presses Enter through a whole set): the running
 * sheet snaps to where it was going and the new one lifts from there. Crossing the phone width
 * turns nothing, nor does a phone's page gaining or losing a row, nor a new set, sort or filter,
 * which remounts the binder. Under reduced motion the view just changes.
 *
 * Set while rendering, as the React Compiler expects, from the view the binder showed last.
 */
export function usePageTurns(start: number, {single, perPage, reducedMotion}: TurnOptions) {
  const [seen, setSeen] = useState<Seen>({start, single, perPage});
  const [turn, setTurn] = useState<Turn | null>(null);
  const turnOf = (from: number, to: number, held: boolean): Turn => ({
    from,
    to,
    held,
    plan: turnPlan(from, to, {single, held, perPage}),
  });
  if (start !== seen.start || !sameShape(seen, {single, perPage})) {
    setSeen({start, single, perPage});
    setTurn(turnsTo(start, {seen, turn, single, perPage, reducedMotion}) ? turnOf(seen.start, start, false) : null);
  }
  return {
    turn,
    /** Takes the page in hand, turning to the view at `to`: the binder still shows this one. */
    hold: (to: number) => {
      const held = turnOf(start, to, true);
      setTurn(held);
      return held;
    },
    /** The turn `ended` landed, or fell back: it goes, unless another has replaced it. */
    end: (ended: Turn) => setTurn((current) => (current === ended ? null : current)),
  };
}
