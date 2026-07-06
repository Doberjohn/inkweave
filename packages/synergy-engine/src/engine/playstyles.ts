import type {Playstyle, PlaystyleId} from '../types';

const playstyles: Playstyle[] = [
  {
    id: 'lore-denial',
    name: 'Lore Denial',
    tagline: 'Cards that make your opponent lose lore.',
  },
  {
    id: 'location-control',
    name: 'Locations',
    tagline: 'Cards that build their value around locations.',
  },
  {
    id: 'discard',
    name: 'Discard',
    tagline: 'Force opponents to discard cards while you keep yours.',
  },
  {
    id: 'toy',
    name: 'Toys',
    tagline: 'Toy characters and the cards that reward running them.',
  },
  {
    id: 'ramp',
    name: 'Ramp',
    tagline: 'Speed up your ink so you can play powerful cards earlier than your opponent.',
  },
  {
    id: 'sacrifice',
    name: 'Sacrifice',
    tagline: 'Banish your own characters on demand to cash in banish payoffs.',
  },
  {
    id: 'self-discard',
    name: 'Self-Discard',
    tagline: 'Discard your own cards, then replay them from the bin or cash in discard payoffs.',
  },
  {
    id: 'dwarfs',
    name: 'Seven Dwarfs',
    tagline: 'Seven Dwarfs characters and the cards that reward running them.',
  },
  {
    id: 'floodborn',
    name: 'Floodborns',
    tagline: 'Flood the board with Floodborn characters and cash in the Vine payoffs.',
  },
  {
    id: 'hunny',
    name: 'Hunny',
    tagline: 'A Hundred Acre Wood adventuring party that rewards going wide on the Hunny tribe.',
  },
  {
    id: 'red-panda',
    name: 'Red Panda',
    tagline: 'A small Turning Red tribe built around the Lee family.',
  },
  {
    id: 'items',
    name: 'Items',
    tagline: 'Flood the board with items and cash in the payoffs that reward playing them.',
  },
  {
    id: 'healing',
    name: 'Healing',
    tagline: 'Remove damage from your own characters, then cash in the payoffs that reward healing.',
  },
  {
    id: 'exert',
    name: 'Exert',
    tagline: 'Tap the opponent’s characters, then banish or lock the exerted bodies.',
  },
  {
    id: 'monster',
    name: 'Monsters',
    tagline: 'Monster characters and the payoffs that reward fielding the tribe.',
  },
  {
    id: 'princess',
    name: 'Princesses',
    tagline: 'Go wide on Princesses and cash in the buffs, searches, and in-play payoffs that reward them.',
  },
  {
    id: 'hero',
    name: 'Heroes',
    tagline: 'Hero characters and the payoffs that buff or trigger off the tribe.',
  },
  {
    id: 'super',
    name: 'Supers',
    tagline: 'The Incredibles Super package: Super characters and the payoffs that pump and ready them.',
  },
  {
    id: 'royalty',
    name: 'Royalty',
    tagline: 'Queen, King, and Prince characters and the payoffs that reward the crown.',
  },
  {
    id: 'detective',
    name: 'Detectives',
    tagline: 'Detective characters and the payoffs that reward running the tribe.',
  },
];

const playstyleMap = new Map(playstyles.map((p) => [p.id, p]));

export const getAllPlaystyles = (): Playstyle[] => [...playstyles];

export const getPlaystyleById = (id: PlaystyleId): Playstyle | undefined => playstyleMap.get(id);
