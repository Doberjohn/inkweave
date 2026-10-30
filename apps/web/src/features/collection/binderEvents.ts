import {trackEvent} from '../../shared/lib/analytics';
import type {BinderShow} from './binderCards';
import type {CollectionEntry, Finish} from './collectionParser';
import type {Axis} from './collectionStats';

/** A count set by hand, as it landed: the printing, the finish, the new count, and both finishes' copies before. */
export interface HandCount {
  cardId: string;
  finish: Finish;
  count: number;
  before: CollectionEntry;
}

/** Where a count was set: a pocket's stripe or the card window's, in which of Browse's modes. */
export interface HandCountPlace {
  surface: 'pocket' | 'window';
  mode: 'grid' | 'binder' | 'friend_binder';
}

/** `collection_copies_changed` for a count set by hand. Never the card. */
export function trackHandCount({finish, count, before}: HandCount, place: HandCountPlace): void {
  trackEvent('collection_copies_changed', {
    ...place,
    finish,
    change: count > before[finish] ? 'add' : 'remove',
    newCard: before.normal + before.foil === 0,
  });
}

type ViewControl = 'set' | 'show' | 'axis' | 'foil_pointer';

/** `binder_view_changed` for a pick of `value` where `was` showed. A pick of what is on show sends nothing. */
export function trackViewPick(control: ViewControl, {value, was}: {value: string; was: string}, friend: boolean): void {
  if (value !== was) trackEvent('binder_view_changed', {control, value, friend});
}

/** The set panel's three picks, which every panel, picker and a phone's cover share. */
interface Picks {
  onSetChange: (set: string) => void;
  onShowChange: (show: BinderShow) => void;
  onAxisChange: (axis: Axis) => void;
}

/** What the binder shows as the picks are offered, and whether it is a friend's. */
interface ShownNow {
  setCode: string;
  show: BinderShow;
  axis: Axis;
  friend: boolean;
}

/** The panel's picks, each sending `binder_view_changed` before it writes. */
export function trackedPicks(picks: Picks, now: ShownNow): Picks {
  return {
    onSetChange: (set) => {
      trackViewPick('set', {value: set, was: now.setCode}, now.friend);
      picks.onSetChange(set);
    },
    onShowChange: (show) => {
      trackViewPick('show', {value: show, was: now.show}, now.friend);
      picks.onShowChange(show);
    },
    onAxisChange: (axis) => {
      trackViewPick('axis', {value: axis, was: now.axis}, now.friend);
      picks.onAxisChange(axis);
    },
  };
}
