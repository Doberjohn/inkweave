import type {BinderShow} from './binderCards';
import {Segment, Segments} from './Segments';

/**
 * How many cards a friend's binder's two views hold: the cards they hold in a finish
 * you lack (You need), and the ones you hold in a finish they lack (They need).
 */
export interface CompareCounts {
  youNeed: number;
  theyNeed: number;
}

/** What the binder shows, and how to change it. */
export interface BinderView {
  show: BinderShow;
  onShowChange: (show: BinderShow) => void;
  /** With a friend's binder open and a collection of your own: You need and They need, counted. */
  compare?: CompareCounts | null;
}

const SHOW_OPTIONS: {value: BinderShow; label: string}[] = [
  {value: 'all', label: 'All'},
  {value: 'owned', label: 'Owned'},
  {value: 'missing', label: 'Missing'},
];

/**
 * What the binder shows: every card, the ones you hold, or the ones you are missing. In the set
 * panel, and on a phone in the Binder sheet (#969), which loads it without the binder's chunk:
 * hence a module of its own. A friend's binder adds a second row, You need and They need, in
 * the same group; six columns let three segments sit over two.
 */
export function BinderShows({show, onShowChange, compare}: BinderView) {
  const own = SHOW_OPTIONS.map(({value, label}) => (
    <Segment
      key={value}
      label={label}
      span={compare ? 2 : undefined}
      active={show === value}
      onSelect={() => onShowChange(value)}
    />
  ));
  if (!compare) {
    return (
      <Segments label="Binder shows" columns="repeat(3, 1fr)">
        {own}
      </Segments>
    );
  }
  return (
    <Segments label="Binder shows" columns="repeat(6, 1fr)">
      {own}
      <Segment
        label="You need"
        count={compare.youNeed}
        span={3}
        active={show === 'you-need'}
        onSelect={() => onShowChange('you-need')}
      />
      <Segment
        label="They need"
        count={compare.theyNeed}
        span={3}
        active={show === 'they-need'}
        onSelect={() => onShowChange('they-need')}
      />
    </Segments>
  );
}
