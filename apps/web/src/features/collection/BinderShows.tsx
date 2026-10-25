import type {BinderShow} from './binderCards';
import {Segment, Segments} from './Segments';

/** What the binder shows, and how to change it. */
export interface BinderView {
  show: BinderShow;
  onShowChange: (show: BinderShow) => void;
}

const SHOW_OPTIONS: {value: BinderShow; label: string}[] = [
  {value: 'all', label: 'All'},
  {value: 'owned', label: 'Owned'},
  {value: 'missing', label: 'Missing'},
];

/**
 * What the binder shows: every card, the ones you hold, or the ones you are missing. In the set
 * panel, and on a phone in the Binder sheet (#969), which loads it without the binder's chunk:
 * hence a module of its own.
 */
export function BinderShows({show, onShowChange}: BinderView) {
  return (
    <Segments label="Binder shows" columns="repeat(3, 1fr)">
      {SHOW_OPTIONS.map(({value, label}) => (
        <Segment key={value} label={label} active={show === value} onSelect={() => onShowChange(value)} />
      ))}
    </Segments>
  );
}
