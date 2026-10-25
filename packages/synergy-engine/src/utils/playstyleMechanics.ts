import type {LorcanaCard} from '../types/card.js';
import type {PlaystyleId} from '../types/playstyle.js';
import {getBounceRoles} from './detection/bounce.js';
import {getDiscardRoles} from './detection/discard.js';
import {getDwarfsRoles} from './detection/dwarfs.js';
import {getExertRoles} from './detection/exert.js';
import {getFloodbornRoles} from './detection/floodborn.js';
import {getHealRoles} from './detection/healing.js';
import {getHunnyRoles} from './detection/hunny.js';
import {getInkDropRoles} from './detection/inkDrops.js';
import {getItemRoles} from './detection/items.js';
import {getLocationRoles} from './detection/locationControl.js';
import {getLoreDenialRoles} from './detection/loreLoss.js';
import {getRampRoles} from './detection/ramp.js';
import {getRedPandaRoles} from './detection/redPanda.js';
import {getSacrificeRoles} from './detection/sacrifice.js';
import {getSelfDiscardRoles} from './detection/selfDiscard.js';
import {getToyRoles} from './detection/toy.js';
import {getTribalRoles, TRIBAL_SPECS, type TribalSpec} from './detection/tribes.js';
import {getCardMechanics, STRUCTURAL_ROLE_TO_MECHANIC} from './mechanics.js';

type RoleGetter = (card: LorcanaCard) => readonly string[];

/** `member` is a card's membership in a tribe, not a mechanic its page shows. */
const withoutMember =
  (getRoles: RoleGetter): RoleGetter =>
  (card) =>
    getRoles(card).filter((role) => role !== 'member');

const tribal = (spec: TribalSpec): RoleGetter => withoutMember((card) => getTribalRoles(card, spec));

/**
 * Each playstyle's structural roles, the half of its page's mechanic tiles that is the
 * playstyle's own. The other half is the generic catalog (`getCardMechanics`).
 */
const PLAYSTYLE_ROLES: Record<PlaystyleId, RoleGetter> = {
  'location-control': getLocationRoles,
  discard: getDiscardRoles,
  'self-discard': getSelfDiscardRoles,
  sacrifice: getSacrificeRoles,
  ramp: getRampRoles,
  'lore-denial': getLoreDenialRoles,
  toy: withoutMember(getToyRoles),
  dwarfs: withoutMember(getDwarfsRoles),
  floodborn: withoutMember(getFloodbornRoles),
  hunny: withoutMember(getHunnyRoles),
  'red-panda': withoutMember(getRedPandaRoles),
  items: withoutMember(getItemRoles),
  healing: getHealRoles,
  exert: getExertRoles,
  bounce: getBounceRoles,
  'ink-drops': getInkDropRoles,
  monster: tribal(TRIBAL_SPECS.monster),
  princess: tribal(TRIBAL_SPECS.princess),
  hero: tribal(TRIBAL_SPECS.hero),
  super: tribal(TRIBAL_SPECS.super),
  royalty: tribal(TRIBAL_SPECS.royalty),
  detective: tribal(TRIBAL_SPECS.detective),
  gargoyle: tribal(TRIBAL_SPECS.gargoyle),
  madrigal: tribal(TRIBAL_SPECS.madrigal),
  villain: tribal(TRIBAL_SPECS.villain),
};

/**
 * The mechanic ids a card shows on its playstyle's page: the playstyle's structural roles on
 * the card, each canonicalised to its catalog twin (`burn` → `lore-burn`), with every generic
 * catalog mechanic the card has. One id per mechanic, so a role and its twin make one tile.
 * Precompute writes these per card (`_playstyleMechanics.json`), so the page runs no detector.
 */
export function getPlaystyleMechanicIds(playstyleId: PlaystyleId, card: LorcanaCard): string[] {
  const ids = new Set<string>();
  for (const role of PLAYSTYLE_ROLES[playstyleId](card)) ids.add(STRUCTURAL_ROLE_TO_MECHANIC[role] ?? role);
  for (const id of getCardMechanics(card)) ids.add(id);
  return [...ids];
}
